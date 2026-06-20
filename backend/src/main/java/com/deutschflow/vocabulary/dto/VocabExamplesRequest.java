package com.deutschflow.vocabulary.dto;

/** Request body for {@code POST /api/vocabulary/ai/examples}. {@code count} is optional (defaults to 3). */
public record VocabExamplesRequest(String word, Integer count) {}
