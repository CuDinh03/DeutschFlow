package com.deutschflow.curriculum.dto;

import java.util.Map;

/**
 * Response of {@code GET /api/roadmap/me/meta} — mirrors the legacy {@code RoadmapService.getRoadmapMeta}
 * map 1:1 (all keys present and non-null; counters are {@code long}).
 */
public record RoadmapMetaDto(
        String roadmapVersion,
        String roadmapType,
        String entryNodeCode,
        String currentLevel,
        String targetLevel,
        String currentNodeCode,
        long completedNodes,
        long totalNodes,
        long progressPercent,
        String progressModel) {

    public static RoadmapMetaDto from(Map<String, Object> m) {
        return new RoadmapMetaDto(
                (String) m.get("roadmapVersion"),
                (String) m.get("roadmapType"),
                (String) m.get("entryNodeCode"),
                (String) m.get("currentLevel"),
                (String) m.get("targetLevel"),
                (String) m.get("currentNodeCode"),
                ((Number) m.get("completedNodes")).longValue(),
                ((Number) m.get("totalNodes")).longValue(),
                ((Number) m.get("progressPercent")).longValue(),
                (String) m.get("progressModel"));
    }
}
