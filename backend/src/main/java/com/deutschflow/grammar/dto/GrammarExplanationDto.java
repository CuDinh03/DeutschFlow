package com.deutschflow.grammar.dto;

/**
 * Response of {@code POST /api/grammar/ai/explain} — mirrors the legacy
 * {@code {text, explanation}} map 1:1 (the echoed input text + the AI explanation).
 */
public record GrammarExplanationDto(String text, String explanation) {}
