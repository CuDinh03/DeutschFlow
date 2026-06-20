package com.deutschflow.grammar.dto;

/**
 * Result of submitting a grammar answer — response of
 * {@code POST /api/grammar/syllabus/exercises/{exerciseId}/submit}.
 * camelCase keys, matching the prior {@code Map.of("correct", "correctAnswer", "explanation")}.
 */
public record GrammarSubmitResultDto(boolean correct, String correctAnswer, String explanation) {}
