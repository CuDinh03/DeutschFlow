package com.deutschflow.vocabulary.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.jdbc.core.JdbcTemplate;
import com.deutschflow.common.config.VocabularyEnrichmentProperties;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class DeepLLemmaBackfillServiceUnitTest {
    @Mock org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    @Mock DeepLTranslationService deepLTranslationService;
    @Mock TranslationUsageMeter translationUsageMeter;
    @Mock com.deutschflow.common.config.VocabularyEnrichmentProperties enrichmentProperties;

    @InjectMocks
    DeepLLemmaBackfillService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }
}
