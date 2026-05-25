package com.deutschflow.vocabulary.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class GlosbeVocabularyImportServiceUnitTest {
    @Mock org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    @Mock GlosbeHtmlParser parser;
    @Mock com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    @InjectMocks
    GlosbeVocabularyImportService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }
}
