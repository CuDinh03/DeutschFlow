package com.deutschflow.vocabulary.dto;

public record VocabularyImageReviewDecisionRequest(
        String unsplashId,
        String decision,
        String personaStyle
) {
}
