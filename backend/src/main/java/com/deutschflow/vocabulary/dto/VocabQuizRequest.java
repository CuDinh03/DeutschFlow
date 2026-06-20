package com.deutschflow.vocabulary.dto;

import java.util.List;

/** Request body for {@code POST /api/vocabulary/ai/quiz}. {@code questionsPerWord} is optional (defaults to 2). */
public record VocabQuizRequest(List<String> words, Integer questionsPerWord) {}
