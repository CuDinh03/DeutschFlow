package com.deutschflow.vocabulary.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class VocabularyResetServiceUnitTest {
    @Mock org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    @Mock GoetheVocabularyAutoImportService goetheVocabularyAutoImportService;
    @Mock GoetheOfficialWordlistImportService goetheOfficialWordlistImportService;
    @Mock WiktionaryEnrichmentBatchService wiktionaryEnrichmentBatchService;

    @InjectMocks
    VocabularyResetService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }
}
