package com.deutschflow.grammar.dto;

/** Request body for {@code POST /api/grammar/ai/practice-suggestions} (legacy key: {@code errorType}). */
public record GrammarPracticeRequest(String errorType) {}
