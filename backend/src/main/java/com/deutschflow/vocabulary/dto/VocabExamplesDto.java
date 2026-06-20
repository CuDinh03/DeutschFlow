package com.deutschflow.vocabulary.dto;

import java.util.List;

/** Response of {@code POST /api/vocabulary/ai/examples} — mirrors the legacy {@code {word, examples}} map. */
public record VocabExamplesDto(String word, List<String> examples) {}
