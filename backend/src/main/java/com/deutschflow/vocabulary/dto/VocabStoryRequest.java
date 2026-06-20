package com.deutschflow.vocabulary.dto;

import java.util.List;

/** Request body for {@code POST /api/vocabulary/ai/story}. */
public record VocabStoryRequest(List<String> words) {}
