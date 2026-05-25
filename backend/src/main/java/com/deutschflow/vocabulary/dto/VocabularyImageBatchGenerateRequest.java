package com.deutschflow.vocabulary.dto;

import java.util.List;

public record VocabularyImageBatchGenerateRequest(
        Integer limit,
        String personaStyle,
        String cefr,
        String dtype,
        String tag,
        List<Long> approvedWordIds
) {
}
