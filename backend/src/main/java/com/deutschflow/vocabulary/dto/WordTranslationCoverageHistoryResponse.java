package com.deutschflow.vocabulary.dto;

import java.util.List;

public record WordTranslationCoverageHistoryResponse(
        int days,
        List<WordTranslationCoverageResponse> items
) {
}
