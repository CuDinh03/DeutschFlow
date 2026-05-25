package com.deutschflow.vocabulary.dto;

public record VocabularyImageReviewItem(
        String unsplashId,
        String thumbUrl,
        String regularUrl,
        String fullUrl,
        String altText,
        String description,
        String photographerName,
        String pageUrl,
        String queryUsed
) {
}
