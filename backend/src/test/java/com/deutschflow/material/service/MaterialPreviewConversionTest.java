package com.deutschflow.material.service;

import com.deutschflow.material.dto.MaterialPreviewDto;
import com.deutschflow.material.dto.MaterialPreviewDto.Mode;
import com.deutschflow.material.entity.Material;
import com.deutschflow.media.service.S3StorageService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The real LibreOffice leg: a genuine .docx goes in, a genuine PDF must come out and land in the S3
 * cache. Everything except S3 is real — the {@code soffice} process, the argument list, the output
 * filename, the temp-dir handling.
 *
 * <p>Skipped (not failed) where LibreOffice is absent, so a laptop or a CI runner without it stays
 * green. It is present in the production image (backend/Dockerfile), which is the environment this
 * test exists to protect: a broken arg list here degrades every Office preview to a download.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("MaterialPreviewService — real LibreOffice conversion")
class MaterialPreviewConversionTest {

    @Mock private S3StorageService s3StorageService;

    /** Where soffice lives: the container's PATH, an explicit override, or a dev Mac's app bundle. */
    private static String sofficePath() {
        String fromEnv = System.getenv("SOFFICE_PATH");
        if (fromEnv != null && !fromEnv.isBlank()) return fromEnv;
        Path mac = Path.of("/Applications/LibreOffice.app/Contents/MacOS/soffice");
        if (Files.isExecutable(mac)) return mac.toString();
        return "soffice";
    }

    private static boolean sofficeInstalled() {
        try {
            Process p = new ProcessBuilder(sofficePath(), "--version")
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                    .redirectError(ProcessBuilder.Redirect.DISCARD)
                    .start();
            return p.waitFor(30, java.util.concurrent.TimeUnit.SECONDS) && p.exitValue() == 0;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    @Test
    @DisplayName("a .docx is converted to a real PDF and cached under materials/preview/")
    void docx_isConvertedToPdfAndCached() throws Exception {
        assumeTrue(sofficeInstalled(), "LibreOffice not installed — skipping the real conversion test");

        Material m = Material.builder()
                .id(42L).kind("DOCX").sizeBytes(2048L)
                .objectKey("materials/p-7/2026/07/abc-123.docx")
                .build();
        when(s3StorageService.objectExists("materials/preview/abc-123.pdf")).thenReturn(false);
        when(s3StorageService.downloadBytes("materials/p-7/2026/07/abc-123.docx")).thenReturn(minimalDocx());
        when(s3StorageService.presignedGetUrl(anyString(), any(Duration.class))).thenReturn("https://s3/preview.pdf");

        MaterialPreviewService svc = new MaterialPreviewService(
                s3StorageService, sofficePath(), 40L * 1024 * 1024, 120, 2);

        MaterialPreviewDto dto = svc.preview(m);

        assertThat(dto.mode()).isEqualTo(Mode.PDF);
        assertThat(dto.url()).isEqualTo("https://s3/preview.pdf");

        ArgumentCaptor<byte[]> pdf = ArgumentCaptor.forClass(byte[].class);
        verify(s3StorageService).uploadBytes(
                pdf.capture(), eq("materials/preview/abc-123.pdf"), eq("application/pdf"));

        byte[] bytes = pdf.getValue();
        assertThat(bytes).hasSizeGreaterThan(500);
        assertThat(new String(bytes, 0, 5, StandardCharsets.ISO_8859_1)).isEqualTo("%PDF-");
    }

    /** A hand-rolled but valid OOXML Word document — avoids adding a test-only Office library. */
    private static byte[] minimalDocx() throws Exception {
        String contentTypes = """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                <Default Extension="xml" ContentType="application/xml"/>
                <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
                </Types>""";
        String rels = """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
                </Relationships>""";
        String document = """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
                <w:body><w:p><w:r><w:t>Modalverben - Lektion 3</w:t></w:r></w:p></w:body>
                </w:document>""";

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            writeEntry(zip, "[Content_Types].xml", contentTypes);
            writeEntry(zip, "_rels/.rels", rels);
            writeEntry(zip, "word/document.xml", document);
        }
        return out.toByteArray();
    }

    private static void writeEntry(ZipOutputStream zip, String name, String body) throws Exception {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(body.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }
}
