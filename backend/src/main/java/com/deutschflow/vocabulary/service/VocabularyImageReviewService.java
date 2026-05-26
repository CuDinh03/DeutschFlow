package com.deutschflow.vocabulary.service;

import com.deutschflow.aiimage.service.UnsplashImageService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.media.entity.MediaAsset;
import com.deutschflow.vocabulary.dto.VocabularyImageReviewDecisionRequest;
import com.deutschflow.vocabulary.dto.VocabularyImageReviewItem;
import com.deutschflow.vocabulary.dto.VocabularyImageReviewResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class VocabularyImageReviewService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectProvider<UnsplashImageService> unsplashImageServiceProvider;
    private final VocabularyImageGeneratorService generatorService;

    public VocabularyImageReviewResponse review(long wordId, int limit) {
        Map<String, Object> row = jdbcTemplate.queryForMap("SELECT base_form, dtype, COALESCE(meaning, '') AS meaning FROM words WHERE id = ?", wordId);
        String baseForm = String.valueOf(row.get("base_form"));
        String dtype = String.valueOf(row.get("dtype"));
        String meaning = String.valueOf(row.get("meaning"));
        String queryUsed = buildQuery(baseForm, meaning);

        UnsplashImageService unsplashImageService = unsplashImageServiceProvider.getIfAvailable();
        if (unsplashImageService == null) {
            throw new IllegalStateException("Unsplash image service is disabled or not configured.");
        }

        List<VocabularyImageReviewItem> suggestions = unsplashImageService.search(queryUsed, 1, limit).stream()
                .map(item -> new VocabularyImageReviewItem(
                        item.id(),
                        item.thumbUrl(),
                        item.regularUrl(),
                        item.fullUrl(),
                        item.altText(),
                        item.description(),
                        item.photographerName(),
                        item.pageUrl(),
                        queryUsed))
                .toList();

        return new VocabularyImageReviewResponse(wordId, baseForm, meaning, dtype, queryUsed, suggestions);
    }

    @Transactional
    public MediaAsset applyDecision(long wordId, VocabularyImageReviewDecisionRequest request) {
        if (request == null || request.unsplashId() == null || request.unsplashId().isBlank()) {
            throw new BadRequestException("unsplashId is required");
        }
        if (request.decision() == null || request.decision().isBlank()) {
            throw new BadRequestException("decision is required");
        }
        if (!"APPROVE".equalsIgnoreCase(request.decision())) {
            throw new BadRequestException("Only APPROVE is supported in the first review flow iteration");
        }

        Map<String, Object> row = jdbcTemplate.queryForMap("SELECT base_form, COALESCE(meaning, '') AS meaning FROM words WHERE id = ?", wordId);
        String baseForm = String.valueOf(row.get("base_form"));
        String personaStyle = request.personaStyle() != null ? request.personaStyle() : "DEFAULT";
        String prompt = "unsplashId=" + request.unsplashId() + "; personaStyle=" + personaStyle;

        // Fast path: frontend sends imageUrl from already-loaded review — no extra Unsplash API call needed.
        if (request.imageUrl() != null && !request.imageUrl().isBlank()) {
            return generatorService.generateFromUrl(wordId, baseForm, request.imageUrl(), personaStyle, prompt);
        }

        // Fallback: re-search Unsplash by unsplashId (legacy callers without imageUrl).
        String meaning = String.valueOf(row.get("meaning"));
        VocabularyImageReviewItem selected = review(wordId, 10).suggestions().stream()
                .filter(item -> request.unsplashId().equals(item.unsplashId()))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Unsplash image not found in search results: " + request.unsplashId()));
        return generatorService.generateFromUrl(wordId, baseForm, selected.fullUrl(), personaStyle, prompt);
    }

    private String buildQuery(String baseForm, String meaning) {
        String m = nullToEmpty(meaning);
        return (nullToEmpty(baseForm) + (m.isBlank() ? "" : " " + m)).trim();
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value.trim();
    }
}
