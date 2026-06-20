package com.deutschflow.srs.dto;

/** Count of SRS cards due for review — response of {@code GET /api/srs/count} (navbar badge). */
public record SrsDueCountDto(long dueCount) {}
