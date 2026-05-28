package com.deutschflow.vocabulary.service;

import com.deutschflow.aiimage.service.UnsplashImageService;
import com.deutschflow.vocabulary.dto.VocabularyImageReviewDecisionRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
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
class VocabularyImageReviewServiceUnitTest {
    @Mock JdbcTemplate jdbcTemplate;
    @Mock UnsplashImageService unsplashImageService;
    @Mock ObjectProvider<UnsplashImageService> unsplashImageServiceProvider;
    @Mock VocabularyImageGeneratorService generatorService;
    @Mock VocabularyImageService vocabularyImageService;

    @InjectMocks
    VocabularyImageReviewService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }

    @Test
    void applyDecision_delegatesOnlyToGeneratorAndDoesNotDoubleApply() {
        service.applyDecision(42L, new VocabularyImageReviewDecisionRequest("u1", "APPROVE", "DEFAULT", "https://images.example/u1.jpg"));

        verify(generatorService).generateFromUrl(42L, "null", "https://images.example/u1.jpg", "DEFAULT", "unsplashId=u1; personaStyle=DEFAULT");
        verify(vocabularyImageService, never()).applyGeneratedImage(eq(42L), any(), anyString(), anyString());
    }

    @Test
    void reviewBuildsSuggestionsFromUnsplashSearch() {
        when(unsplashImageServiceProvider.getIfAvailable()).thenReturn(unsplashImageService);
        when(jdbcTemplate.queryForMap(anyString(), eq(7L)))
                .thenReturn(Map.of("base_form", "Buch", "dtype", "NOUN", "meaning", "book"));
        when(unsplashImageService.search(anyString(), eq(1), eq(3))).thenReturn(List.of());

        var review = service.review(7L, 3);

        assertEquals(7L, review.wordId());
        assertEquals("Buch", review.baseForm());
        assertEquals("book", review.meaning());
        assertEquals(0, review.suggestions().size());
    }
}
