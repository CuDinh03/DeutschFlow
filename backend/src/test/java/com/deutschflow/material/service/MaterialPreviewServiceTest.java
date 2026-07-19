package com.deutschflow.material.service;

import com.deutschflow.material.dto.MaterialPreviewDto;
import com.deutschflow.material.dto.MaterialPreviewDto.Mode;
import com.deutschflow.material.entity.Material;
import com.deutschflow.media.service.S3StorageService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Mode resolution + the S3 preview cache. The LibreOffice leg is deliberately NOT exercised here (it
 * needs a real {@code soffice} binary); it is covered by the "converter unavailable → FAILED, never a
 * crash" case, which is exactly how this class behaves on a dev box without LibreOffice installed.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("MaterialPreviewService Unit Tests")
class MaterialPreviewServiceTest {

    @Mock private S3StorageService s3StorageService;

    /** soffice-path points at a binary that cannot exist → the convert leg always degrades to FAILED. */
    private MaterialPreviewService service() {
        return new MaterialPreviewService(s3StorageService, "/nonexistent/soffice", 40L * 1024 * 1024, 5, 2);
    }

    private Material.MaterialBuilder file(String kind, String objectKey) {
        return Material.builder().id(1L).kind(kind).objectKey(objectKey).sizeBytes(1024L);
    }

    @Test
    @DisplayName("PDF/image/audio/video are served as-is — the browser already renders them inline")
    void nativeKinds_servedWithoutConversion() {
        when(s3StorageService.presignedGetUrl(anyString(), any(Duration.class))).thenReturn("https://s3/signed");
        MaterialPreviewService svc = service();

        assertThat(svc.preview(file("PDF", "materials/p-7/2026/07/a.pdf").build()).mode()).isEqualTo(Mode.PDF);
        assertThat(svc.preview(file("IMAGE", "materials/p-7/2026/07/a.png").build()).mode()).isEqualTo(Mode.IMAGE);
        assertThat(svc.preview(file("AUDIO", "materials/p-7/2026/07/a.mp3").build()).mode()).isEqualTo(Mode.AUDIO);
        assertThat(svc.preview(file("VIDEO", "materials/p-7/2026/07/a.mp4").build()).mode()).isEqualTo(Mode.VIDEO);

        verify(s3StorageService, never()).downloadBytes(anyString());
    }

    @Test
    @DisplayName("kind=LINK returns the external URL to open in a new tab, never an embed")
    void link_returnsExternalUrl() {
        Material m = Material.builder().id(2L).kind("LINK").externalUrl("https://allango.net/x").build();

        MaterialPreviewDto dto = service().preview(m);

        assertThat(dto.mode()).isEqualTo(Mode.LINK);
        assertThat(dto.url()).isEqualTo("https://allango.net/x");
    }

    @Test
    @DisplayName("a cached preview PDF is reused — the file is not converted twice")
    void cachedPreview_isReused() {
        Material m = file("DOCX", "materials/p-7/2026/07/abc-123.docx").build();
        when(s3StorageService.objectExists("materials/preview/abc-123.pdf")).thenReturn(true);
        when(s3StorageService.presignedGetUrl(anyString(), any(Duration.class))).thenReturn("https://s3/preview");

        MaterialPreviewDto dto = service().preview(m);

        assertThat(dto.mode()).isEqualTo(Mode.PDF);
        assertThat(dto.url()).isEqualTo("https://s3/preview");
        verify(s3StorageService).presignedGetUrl("materials/preview/abc-123.pdf", Duration.ofHours(1));
        verify(s3StorageService, never()).downloadBytes(anyString());
    }

    @Test
    @DisplayName("a format LibreOffice cannot open is UNSUPPORTED — no download attempt, no conversion")
    void unknownFormat_isUnsupported() {
        Material m = file("OTHER", "materials/p-7/2026/07/pack.zip").build();

        assertThat(service().preview(m).mode()).isEqualTo(Mode.UNSUPPORTED);
        verify(s3StorageService, never()).downloadBytes(anyString());
    }

    @Test
    @DisplayName("a file above the convert cap degrades to FAILED instead of tying up the converter")
    void oversizeFile_isFailed() {
        Material m = file("PPTX", "materials/p-7/2026/07/huge.pptx").sizeBytes(200L * 1024 * 1024).build();
        when(s3StorageService.objectExists(anyString())).thenReturn(false);

        assertThat(service().preview(m).mode()).isEqualTo(Mode.FAILED);
        verify(s3StorageService, never()).downloadBytes(anyString());
    }

    @Test
    @DisplayName("a missing LibreOffice degrades to FAILED (download still works) rather than throwing")
    void converterUnavailable_isFailed() {
        Material m = file("DOCX", "materials/p-7/2026/07/lesson.docx").build();
        when(s3StorageService.objectExists(anyString())).thenReturn(false);

        assertThat(service().preview(m).mode()).isEqualTo(Mode.FAILED);
        verify(s3StorageService, never()).uploadBytes(any(), anyString(), anyString());
    }

    @Test
    @DisplayName("preview keys are derived from the source key's UUID basename (stable across opens)")
    void previewKey_isDeterministic() {
        assertThat(MaterialPreviewService.previewKeyFor("materials/p-7/2026/07/abc-123.docx"))
                .isEqualTo("materials/preview/abc-123.pdf");
        assertThat(MaterialPreviewService.previewKeyFor("materials/9/2026/07/deck.PPTX"))
                .isEqualTo("materials/preview/deck.pdf");
    }

    @Test
    @DisplayName("extensions are matched case-insensitively — an uppercase .DOCX still previews")
    void extension_isCaseInsensitive() {
        Material m = file("DOCX", "materials/p-7/2026/07/abc.DOCX").build();
        when(s3StorageService.objectExists("materials/preview/abc.pdf")).thenReturn(true);
        when(s3StorageService.presignedGetUrl(anyString(), any(Duration.class))).thenReturn("https://s3/preview");

        assertThat(service().preview(m).mode()).isEqualTo(Mode.PDF);
    }
}
