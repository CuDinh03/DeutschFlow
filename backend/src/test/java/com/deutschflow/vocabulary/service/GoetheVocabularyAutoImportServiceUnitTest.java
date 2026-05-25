package com.deutschflow.vocabulary.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class GoetheVocabularyAutoImportServiceUnitTest {
    @Mock org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    @Mock WiktionaryScraperService wiktionaryScraperService;
    @Mock DeepLTranslationService deepLTranslationService;
    @Mock LocalLexiconService localLexiconService;

    @InjectMocks
    GoetheVocabularyAutoImportService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }
}
