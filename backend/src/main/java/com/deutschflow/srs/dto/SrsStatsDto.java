package com.deutschflow.srs.dto;

/** SRS summary stats — response of {@code GET /api/srs/stats}. */
public record SrsStatsDto(long dueCount, long totalCards) {}
