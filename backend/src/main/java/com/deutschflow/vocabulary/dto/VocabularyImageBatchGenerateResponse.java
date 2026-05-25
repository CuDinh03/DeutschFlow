package com.deutschflow.vocabulary.dto;

public record VocabularyImageBatchGenerateResponse(
        int limit,
        String personaStyle,
        int created,
        int missingCount
) {
}
