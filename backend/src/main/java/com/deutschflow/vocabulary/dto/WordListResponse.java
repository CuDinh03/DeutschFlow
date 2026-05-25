package com.deutschflow.vocabulary.dto;

import java.util.List;

public record WordListResponse(
        List<WordListItem> items,
        int page,
        int size,
        long total
) {}

