package com.deutschflow.vocabulary.dto;

/** Response of {@code POST /api/vocabulary/ai/usage} — mirrors the legacy {@code {word, usage}} map. */
public record VocabUsageDto(String word, String usage) {}
