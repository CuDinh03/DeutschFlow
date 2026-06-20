package com.deutschflow.grammar.dto;

/** Request body for {@code POST /api/grammar/ai/explain} (legacy key: {@code text}). */
public record GrammarExplainRequest(String text) {}
