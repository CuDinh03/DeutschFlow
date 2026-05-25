package com.deutschflow.config;

import com.deutschflow.media.service.MediaAssetService;
import com.deutschflow.vocabulary.service.VocabularyImageBatchService;
import com.deutschflow.vocabulary.service.VocabularyImageGeneratorService;
import org.mockito.Mockito;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

@TestConfiguration
public class TestMediaConfig {

    @Bean
    @Primary
    public MediaAssetService mediaAssetService() {
        return Mockito.mock(MediaAssetService.class);
    }

    @Bean
    @Primary
    public VocabularyImageGeneratorService vocabularyImageGeneratorService() {
        return Mockito.mock(VocabularyImageGeneratorService.class);
    }

    @Bean
    @Primary
    public VocabularyImageBatchService vocabularyImageBatchService() {
        return Mockito.mock(VocabularyImageBatchService.class);
    }
}
