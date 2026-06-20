package com.deutschflow.curriculum.dto;

/**
 * Response of {@code POST /api/roadmap/setup} — mirrors the legacy {@code LinkedHashMap} 1:1
 * (all keys present and non-null).
 */
public record RoadmapSetupResultDto(
        boolean saved,
        String roadmapVersion,
        String roadmapType,
        String currentLevel,
        String targetLevel,
        String nextRoute) {}
