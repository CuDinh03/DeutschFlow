package com.deutschflow.material.service;

import com.deutschflow.material.dto.MaterialPreviewDto;
import com.deutschflow.material.dto.MaterialPreviewDto.Mode;
import com.deutschflow.material.entity.Material;
import com.deutschflow.media.service.S3StorageService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

/**
 * In-browser preview of a material — "click to read", no download.
 *
 * <p>PDFs, images, audio and video already render inline from the Content-Type stored on the S3 object,
 * so they are served as-is. Word/PowerPoint/Excel cannot be rendered by any browser, so they are
 * converted to PDF <em>once</em> by headless LibreOffice running inside our own container, cached back
 * to S3 under {@value #PREVIEW_PREFIX}, and then served like any other PDF. The document therefore
 * never leaves our infrastructure — deliberately NOT a third-party viewer (Office Web Viewer / Google
 * Docs viewer), which would ship a center's teaching material to an outside host to render it.
 *
 * <p>Conversion is bounded on three axes because {@code soffice} is CPU- and RAM-hungry and the box is
 * a t3.medium: file size ({@code maxConvertBytes}), wall-clock ({@code timeoutSeconds}) and parallelism
 * ({@code maxConcurrent}). Exceeding any of them degrades to {@link Mode#FAILED} — the caller keeps the
 * download link and may retry — never to a 500.
 */
@Slf4j
@Service
public class MaterialPreviewService {

    /** Cache prefix, separate from the source objects so it can be lifecycle-swept independently. */
    private static final String PREVIEW_PREFIX = "materials/preview/";
    private static final Duration PREVIEW_URL_TTL = Duration.ofHours(1);

    /** Extensions LibreOffice renders faithfully to PDF. Anything else is {@link Mode#UNSUPPORTED}. */
    private static final Set<String> CONVERTIBLE_EXT = Set.of(
            "doc", "docx", "odt", "rtf",
            "ppt", "pptx", "odp",
            "xls", "xlsx", "ods");

    /** kind → how the browser renders the ORIGINAL object, no conversion needed. */
    private static final Map<String, Mode> NATIVE_MODE = Map.of(
            "PDF", Mode.PDF,
            "IMAGE", Mode.IMAGE,
            "AUDIO", Mode.AUDIO,
            "VIDEO", Mode.VIDEO);

    private final S3StorageService s3StorageService;
    private final String sofficePath;
    private final long maxConvertBytes;
    private final int timeoutSeconds;
    private final Semaphore slots;

    /** Probed once on first use: a dev box without LibreOffice degrades to FAILED instead of hanging. */
    private volatile Boolean sofficeAvailable;

    public MaterialPreviewService(
            S3StorageService s3StorageService,
            @Value("${materials.preview.soffice-path:soffice}") String sofficePath,
            @Value("${materials.preview.max-convert-bytes:41943040}") long maxConvertBytes,
            @Value("${materials.preview.timeout-seconds:90}") int timeoutSeconds,
            @Value("${materials.preview.max-concurrent:2}") int maxConcurrent) {
        this.s3StorageService = s3StorageService;
        this.sofficePath = sofficePath;
        this.maxConvertBytes = maxConvertBytes;
        this.timeoutSeconds = timeoutSeconds;
        this.slots = new Semaphore(Math.max(1, maxConcurrent));
    }

    /**
     * Resolves what the client should render for {@code m}. The caller MUST have already authorized
     * access — this method does no permission checking.
     */
    public MaterialPreviewDto preview(Material m) {
        if (m.getObjectKey() == null) {
            // kind=LINK — an external URL we neither host nor frame (X-Frame-Options is theirs to set).
            return m.getExternalUrl() == null
                    ? MaterialPreviewDto.unsupported()
                    : MaterialPreviewDto.of(Mode.LINK, m.getExternalUrl());
        }

        Mode nativeMode = NATIVE_MODE.get(m.getKind());
        if (nativeMode != null) {
            return MaterialPreviewDto.of(nativeMode, presign(m.getObjectKey()));
        }

        if (!CONVERTIBLE_EXT.contains(extensionOf(m.getObjectKey()))) {
            return MaterialPreviewDto.unsupported();
        }

        String previewKey = previewKeyFor(m.getObjectKey());
        if (s3StorageService.objectExists(previewKey)) {
            return MaterialPreviewDto.of(Mode.PDF, presign(previewKey));
        }
        return convertAndCache(m, previewKey);
    }

    /** Converts the source object to PDF, caches it at {@code previewKey}, and presigns it. */
    private MaterialPreviewDto convertAndCache(Material m, String previewKey) {
        if (m.getSizeBytes() != null && m.getSizeBytes() > maxConvertBytes) {
            log.info("Preview skipped for material {}: {} bytes exceeds the {} byte convert cap",
                    m.getId(), m.getSizeBytes(), maxConvertBytes);
            return MaterialPreviewDto.failed();
        }
        if (!sofficeAvailable()) {
            return MaterialPreviewDto.failed();
        }

        boolean acquired = false;
        Path workDir = null;
        try {
            // Bounded wait rather than an unbounded queue: a teacher would rather be told "retry" than
            // watch a spinner while N conversions ahead of them fight for the box's two cores.
            acquired = slots.tryAcquire(20, TimeUnit.SECONDS);
            if (!acquired) {
                log.warn("Preview converter busy — no slot for material {} within 20s", m.getId());
                return MaterialPreviewDto.failed();
            }

            workDir = Files.createTempDirectory("mat-preview-");
            Path source = workDir.resolve("source." + extensionOf(m.getObjectKey()));
            Files.write(source, s3StorageService.downloadBytes(m.getObjectKey()));

            Path pdf = convertToPdf(source, workDir);
            byte[] bytes = Files.readAllBytes(pdf);
            s3StorageService.uploadBytes(bytes, previewKey, "application/pdf");
            log.info("Preview cached for material {} → {} ({} bytes)", m.getId(), previewKey, bytes.length);

            return MaterialPreviewDto.of(Mode.PDF, presign(previewKey));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return MaterialPreviewDto.failed();
        } catch (Exception e) {
            // A malformed/DRM'd/exotic Office file is a normal outcome, not an incident: the teacher
            // still gets the download link. Logged at WARN with the id so a pattern is greppable.
            log.warn("Preview conversion failed for material {} ({})", m.getId(), m.getObjectKey(), e);
            return MaterialPreviewDto.failed();
        } finally {
            if (acquired) slots.release();
            deleteQuietly(workDir);
        }
    }

    /** Runs headless LibreOffice and returns the produced PDF. */
    private Path convertToPdf(Path source, Path workDir) throws IOException, InterruptedException {
        // -env:UserInstallation gives THIS conversion its own LibreOffice profile. Without it, concurrent
        // soffice processes contend on a single shared ~/.config profile and silently exit 0 having
        // written nothing — the classic headless-LibreOffice race.
        Path profile = workDir.resolve("lo-profile");
        List<String> command = List.of(
                sofficePath,
                "--headless", "--norestore", "--invisible", "--nolockcheck", "--nodefault",
                "-env:UserInstallation=file://" + profile.toAbsolutePath(),
                // Plain "pdf" — NOT "pdf:writer_pdf_Export". The explicit filter is Writer's; forcing it
                // on a .pptx/.xlsx makes soffice bail. Unqualified, LibreOffice picks the export filter
                // that matches the document type (writer/impress/calc).
                "--convert-to", "pdf",
                "--outdir", workDir.toAbsolutePath().toString(),
                source.toAbsolutePath().toString());

        Process p = new ProcessBuilder(command)
                .redirectErrorStream(true)
                .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                .start();
        boolean finished = p.waitFor(timeoutSeconds, TimeUnit.SECONDS);
        if (!finished) {
            p.destroyForcibly();
            throw new IOException("soffice timed out after " + timeoutSeconds + "s");
        }
        if (p.exitValue() != 0) {
            throw new IOException("soffice exited " + p.exitValue());
        }

        Path pdf = workDir.resolve("source.pdf");
        if (!Files.isRegularFile(pdf) || Files.size(pdf) == 0) {
            // soffice reports exit 0 even when it converts nothing (unreadable input, missing filter).
            throw new IOException("soffice produced no PDF");
        }
        return pdf;
    }

    /** Cached probe — mirrors {@code VideoRenderService}'s ffmpeg check. */
    private boolean sofficeAvailable() {
        Boolean cached = sofficeAvailable;
        if (cached != null) return cached;

        boolean ok;
        try {
            Process p = new ProcessBuilder(sofficePath, "--version")
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                    .redirectError(ProcessBuilder.Redirect.DISCARD)
                    .start();
            ok = p.waitFor(20, TimeUnit.SECONDS) && p.exitValue() == 0;
            if (p.isAlive()) p.destroyForcibly();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            ok = false;
        } catch (Exception e) {
            ok = false;
        }
        if (!ok) {
            log.warn("LibreOffice ('{}') not runnable — Office materials cannot be previewed in-browser "
                    + "and will fall back to download. Install it, or set materials.preview.soffice-path.",
                    sofficePath);
        }
        sofficeAvailable = ok;
        return ok;
    }

    private String presign(String objectKey) {
        return s3StorageService.presignedGetUrl(objectKey, PREVIEW_URL_TTL);
    }

    /**
     * {@code materials/p-7/2026/07/<uuid>.docx} → {@code materials/preview/<uuid>.pdf}. Deterministic
     * (so the cache is hit on every later open) and collision-free (the basename is a UUID minted per
     * upload). Owner scope is deliberately NOT re-encoded here: the key is never guessed by a client,
     * only ever presigned after an access check.
     */
    static String previewKeyFor(String objectKey) {
        String basename = objectKey.substring(objectKey.lastIndexOf('/') + 1);
        int dot = basename.lastIndexOf('.');
        return PREVIEW_PREFIX + (dot > 0 ? basename.substring(0, dot) : basename) + ".pdf";
    }

    static String extensionOf(String objectKey) {
        int dot = objectKey.lastIndexOf('.');
        return dot < 0 ? "" : objectKey.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private static void deleteQuietly(Path dir) {
        if (dir == null) return;
        try (Stream<Path> walk = Files.walk(dir)) {
            walk.sorted(Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (IOException ignored) {
                    // best-effort: the temp dir is under /tmp and reaped on container restart anyway
                }
            });
        } catch (IOException e) {
            log.debug("Could not clean preview temp dir {}", dir, e);
        }
    }
}
