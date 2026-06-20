package com.deutschflow.speaking.dto;

/**
 * Response of {@code POST /api/speaking/ai/cultural-context} — mirrors the legacy
 * {@code {topic, culturalContext}} map 1:1 (echoed topic + AI cultural note).
 */
public record CulturalContextResponseDto(String topic, String culturalContext) {}
