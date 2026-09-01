package com.deutschflow.teacher.curriculumimport.ocr;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

/**
 * Local OCR through the {@code tesseract} CLI.
 *
 * <p>Mirrors how the codebase already drives LibreOffice for material previews: an explicit binary
 * path, a cached availability probe, a wall-clock timeout with a forcible kill, and a small
 * permit pool so a burst of imports cannot take the box's cores away from serving requests.
 *
 * <p>Nothing leaves the container and no credential is involved, so a coursebook stays where the
 * centre put it.
 */
@Service
@Slf4j
public class LocalTesseractOcrProvider implements OcrProvider {

    private final String binaryPath;
    private final int timeoutSeconds;
    private final Semaphore slots;

    private volatile Boolean available;

    public LocalTesseractOcrProvider(
            @Value("${curriculum.import.ocr.tesseract-path:tesseract}") String binaryPath,
            @Value("${curriculum.import.ocr.timeout-seconds:60}") int timeoutSeconds,
            @Value("${curriculum.import.ocr.max-concurrent:1}") int maxConcurrent) {
        this.binaryPath = binaryPath;
        this.timeoutSeconds = timeoutSeconds;
        this.slots = new Semaphore(Math.max(1, maxConcurrent));
    }

    @Override
    public String name() {
        return "tesseract-local";
    }

    @Override
    public boolean isAvailable() {
        Boolean cached = available;
        if (cached != null) return cached;

        boolean ok;
        try {
            Process p = new ProcessBuilder(binaryPath, "--version")
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
            log.warn("Tesseract ('{}') not runnable — scanned documents cannot be read locally. "
                    + "Teachers can still import from a managed curriculum template.", binaryPath);
        }
        available = ok;
        return ok;
    }

    @Override
    public String ocrPage(byte[] imageBytes, String languageTag) {
        if (imageBytes == null || imageBytes.length == 0) return "";
        if (!isAvailable()) {
            throw new OcrException("Tesseract không khả dụng trên máy chủ.");
        }

        boolean acquired = false;
        Path workDir = null;
        try {
            acquired = slots.tryAcquire(30, TimeUnit.SECONDS);
            if (!acquired) {
                throw new OcrException("Máy chủ đang bận nhận dạng tài liệu khác — hãy thử lại.");
            }
            workDir = Files.createTempDirectory("toc-ocr-");
            Path image = workDir.resolve("page.png");
            Files.write(image, imageBytes);
            Path outBase = workDir.resolve("page-out");

            // "-" would stream to stdout, but tesseract also writes progress there on some builds;
            // an explicit output base keeps the recognised text unambiguous.
            List<String> command = List.of(
                    binaryPath,
                    image.toAbsolutePath().toString(),
                    outBase.toAbsolutePath().toString(),
                    "-l", languageTag == null || languageTag.isBlank() ? "deu" : languageTag,
                    "--psm", "6");

            Process p = new ProcessBuilder(command)
                    .redirectErrorStream(true)
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                    .start();
            if (!p.waitFor(timeoutSeconds, TimeUnit.SECONDS)) {
                p.destroyForcibly();
                throw new OcrException("Nhận dạng ký tự quá thời gian (" + timeoutSeconds + "s).");
            }
            if (p.exitValue() != 0) {
                throw new OcrException("Tesseract kết thúc với mã " + p.exitValue() + ".");
            }

            Path txt = workDir.resolve("page-out.txt");
            return Files.isRegularFile(txt) ? Files.readString(txt) : "";
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new OcrException("Nhận dạng ký tự bị gián đoạn.", e);
        } catch (IOException e) {
            throw new OcrException("Không đọc được kết quả nhận dạng ký tự.", e);
        } finally {
            if (acquired) slots.release();
            deleteQuietly(workDir);
        }
    }

    private static void deleteQuietly(Path dir) {
        if (dir == null) return;
        try (var walk = Files.walk(dir)) {
            walk.sorted(java.util.Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (IOException ignored) {
                    // best effort — the temp dir is reclaimed by the OS
                }
            });
        } catch (IOException ignored) {
            // best effort
        }
    }
}
