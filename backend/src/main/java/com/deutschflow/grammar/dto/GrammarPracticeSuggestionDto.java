package com.deutschflow.grammar.dto;

/**
 * Response of {@code POST /api/grammar/ai/practice-suggestions} — mirrors the legacy
 * {@code {errorType, suggestions}} map 1:1 (the echoed error type + AI practice suggestions).
 */
public record GrammarPracticeSuggestionDto(String errorType, String suggestions) {}
