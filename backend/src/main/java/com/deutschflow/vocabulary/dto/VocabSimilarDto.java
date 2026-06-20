package com.deutschflow.vocabulary.dto;

import java.util.List;

/** Response of {@code POST /api/vocabulary/ai/similar} — mirrors the legacy {@code {word, similarWords}} map. */
public record VocabSimilarDto(String word, List<String> similarWords) {}
