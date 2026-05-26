package com.deutschflow.vocabulary.dto;

public record VocabularyImageReviewDecisionRequest(
        String unsplashId,
        String decision,
        String personaStyle,
        /** Full-resolution URL from the already-loaded review; if present, backend skips re-searching Unsplash. */
        String imageUrl
) {
}
