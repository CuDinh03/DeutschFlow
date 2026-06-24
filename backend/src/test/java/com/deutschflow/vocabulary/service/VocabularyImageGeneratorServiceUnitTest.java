package com.deutschflow.vocabulary.service;

import com.deutschflow.aiimage.service.UnsplashImageService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.media.service.MediaAssetService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

@ExtendWith(MockitoExtension.class)
class VocabularyImageGeneratorServiceUnitTest {
    @Mock MediaAssetService mediaAssetService;
    @Mock VocabularyImageService vocabularyImageService;
    @Mock UnsplashImageService unsplashImageService;

    @InjectMocks
    VocabularyImageGeneratorService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }

    // SEC-6: generateFromUrl must reject non-Unsplash hosts before any server-side fetch (SSRF guard).
    @Test
    void generateFromUrl_rejectsCloudMetadataHost() {
        assertThrows(BadRequestException.class, () ->
                service.generateFromUrl(1L, "Haus",
                        "http://169.254.169.254/latest/meta-data/iam/", "DEFAULT", "p"));
    }

    @Test
    void generateFromUrl_rejectsLocalhostHost() {
        assertThrows(BadRequestException.class, () ->
                service.generateFromUrl(1L, "Haus", "http://localhost:8080/internal", "DEFAULT", "p"));
    }
}
