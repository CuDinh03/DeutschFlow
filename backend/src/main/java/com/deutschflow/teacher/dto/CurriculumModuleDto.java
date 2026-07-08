package com.deutschflow.teacher.dto;

import com.deutschflow.teacher.entity.CurriculumModule;

import java.time.LocalDateTime;

public record CurriculumModuleDto(
        Long id,
        Long classId,
        int orderIndex,
        String title,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static CurriculumModuleDto from(CurriculumModule m) {
        return new CurriculumModuleDto(m.getId(), m.getClassId(), m.getOrderIndex(), m.getTitle(),
                m.getCreatedAt(), m.getUpdatedAt());
    }
}
