package com.deutschflow.vocabulary.dto;

import java.util.List;

public record WordCoverageHistoryResponse(
        int days,
        List<WordCoverageResponse> items
) {}

