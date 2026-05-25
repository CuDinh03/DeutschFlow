package com.deutschflow.vocabulary.service;

import com.deutschflow.aiimage.service.UnsplashImageService;
import com.deutschflow.media.service.MediaAssetService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertNotNull;

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
}
