package com.deutschflow.vocabulary.dto;

import java.util.List;

public record VocabularyImageReviewResponse(
        long wordId,
        String baseForm,
        String meaning,
        String dtype,
        String queryUsed,
        List<VocabularyImageReviewItem> suggestions
) {
}
