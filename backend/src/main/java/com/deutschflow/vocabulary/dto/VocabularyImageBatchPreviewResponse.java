package com.deutschflow.vocabulary.dto;

import java.util.List;

public record VocabularyImageBatchPreviewResponse(
        int limit,
        String personaStyle,
        int missingCount,
        List<Long> missingWordIds
) {
}
