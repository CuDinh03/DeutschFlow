package com.deutschflow.organization.dto;

import java.time.LocalDateTime;

public record CurriculumVersionSummaryDto(
        Long id,
        int versionNo,
        String status,
        long lektionCount,
        LocalDateTime publishedAt,
        long linkedClassCount
) {}
