package com.deutschflow.organization.dto;

/** PATCH metadata bộ giáo trình — field null giữ nguyên giá trị cũ. */
public record UpdateCurriculumRequest(
        String name,
        String cefrLevel,
        String description
) {}
