package com.deutschflow.organization.dto;

public record CurriculumItemDto(
        Long id,
        int orderIndex,
        String text,
        String skillTag,
        String contentTag,
        Integer estimatedMinutes
) {}
