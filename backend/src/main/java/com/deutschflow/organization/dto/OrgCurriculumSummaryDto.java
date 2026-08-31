package com.deutschflow.organization.dto;

import java.time.LocalDateTime;
import java.util.List;

public record OrgCurriculumSummaryDto(
        Long id,
        String name,
        String cefrLevel,
        String description,
        boolean sample,
        LocalDateTime createdAt,
        List<CurriculumVersionSummaryDto> versions
) {}
