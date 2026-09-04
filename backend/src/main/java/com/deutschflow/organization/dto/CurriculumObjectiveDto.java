package com.deutschflow.organization.dto;

public record CurriculumObjectiveDto(
        Long id,
        int orderIndex,
        String text,
        String cefrLevel,
        String skillTag
) {}
