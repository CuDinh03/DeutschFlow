package com.deutschflow.grammar.dto;

/**
 * Request body for {@code POST /api/grammar/ai/practice-suggestions}.
 *
 * <p>Two modes:
 * <ul>
 *   <li>CEFR mode (web default tab): {@code {cefrLevel, count}} → structured suggestions by level.</li>
 *   <li>Legacy error mode: {@code {errorType}} → suggestions targeted at one grammar error.</li>
 * </ul>
 * All fields optional; the controller picks the mode from whichever is present (cefrLevel wins).
 */
public record GrammarPracticeRequest(String errorType, String cefrLevel, Integer count) {}
