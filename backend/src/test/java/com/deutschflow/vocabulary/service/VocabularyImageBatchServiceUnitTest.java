package com.deutschflow.vocabulary.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VocabularyImageBatchServiceUnitTest {
    @Mock JdbcTemplate jdbcTemplate;
    @Mock VocabularyImageGeneratorService generatorService;

    @InjectMocks
    VocabularyImageBatchService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }

    @Test
    void generateBatch_usesGeneratorOncePerMissingWordAndDoesNotDoubleWrite() {
        when(jdbcTemplate.queryForList(anyString(), eq(Long.class), any(Object[].class)))
                .thenReturn(List.of(11L, 22L));
        when(jdbcTemplate.queryForMap(anyString(), eq(11L)))
                .thenReturn(Map.of("base_form", "Haus", "dtype", "NOUN", "meaning", "house"));
        when(jdbcTemplate.queryForMap(anyString(), eq(22L)))
                .thenReturn(Map.of("base_form", "Laufen", "dtype", "VERB", "meaning", "run"));

        service.generateBatch(2, "DEFAULT", null, null, null, null);

        verify(generatorService).generateAndApply(11L, "Haus", "house", "NOUN", "DEFAULT");
        verify(generatorService).generateAndApply(22L, "Laufen", "run", "VERB", "DEFAULT");
        verify(jdbcTemplate, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void countMissingImages_returnsZeroWhenDatabaseReturnsNull() {
        when(jdbcTemplate.queryForObject(
                eq("SELECT COUNT(*) FROM words WHERE image_url IS NULL OR TRIM(image_url) = ''"),
                eq(Integer.class)
        )).thenReturn(null);

        assertEquals(0, service.countMissingImages());
    }
}
