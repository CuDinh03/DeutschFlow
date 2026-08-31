package com.deutschflow.organization.dto;

/** Tạo bộ giáo trình mới — sinh kèm phiên bản 1 (DRAFT) rỗng. */
public record CreateCurriculumRequest(
        String name,
        String cefrLevel,
        String description
) {}
