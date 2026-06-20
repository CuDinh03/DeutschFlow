package com.deutschflow.vocabulary.dto;

/** Response of {@code POST /api/vocabulary/ai/etymology} — mirrors the legacy {@code {word, etymology}} map. */
public record VocabEtymologyDto(String word, String etymology) {}
