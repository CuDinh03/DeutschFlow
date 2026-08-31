package com.deutschflow.organization.dto;

import java.time.LocalDateTime;

public record ClassCurriculumLinkDto(
        Long classId,
        Long curriculumId,
        String curriculumName,
        Long versionId,
        int versionNo,
        String versionStatus,
        LocalDateTime assignedAt
) {}
