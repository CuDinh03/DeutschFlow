package com.deutschflow.speaking.dto;

/**
 * Response of {@code POST /api/speaking/ai/error-practice} — mirrors the legacy
 * {@code {errorType, exercises}} map 1:1. {@code exercises} is the AI-generated practice block as a
 * single string (the legacy map declared {@code <String,Object>} but only ever put a String here).
 */
public record ErrorPracticeResponseDto(String errorType, String exercises) {}
