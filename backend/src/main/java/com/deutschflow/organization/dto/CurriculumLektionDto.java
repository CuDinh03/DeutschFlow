package com.deutschflow.organization.dto;

import java.util.List;

public record CurriculumLektionDto(
        Long id,
        int orderIndex,
        String title,
        String description,
        List<CurriculumItemDto> items,
        List<CurriculumObjectiveDto> objectives
) {}
