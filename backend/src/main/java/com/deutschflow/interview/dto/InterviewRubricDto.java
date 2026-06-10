package com.deutschflow.interview.dto;

import com.deutschflow.interview.entity.InterviewRubricTemplate;

import java.time.LocalDateTime;

/**
 * API contract for interview rubric templates. Decouples the admin endpoints from
 * the JPA entity (BE-H8): avoids leaking internal mapping/lazy state and keeps the
 * HTTP shape stable when the entity schema changes.
 */
public record InterviewRubricDto(
        Long id,
        String industry,
        String roleGroup,
        String levelRange,
        String phase,
        String criteriaJson,
        String weightJson,
        int version,
        boolean active,
        LocalDateTime createdAt
) {
    public static InterviewRubricDto from(InterviewRubricTemplate entity) {
        return new InterviewRubricDto(
                entity.getId(),
                entity.getIndustry(),
                entity.getRoleGroup(),
                entity.getLevelRange(),
                entity.getPhase(),
                entity.getCriteriaJson(),
                entity.getWeightJson(),
                entity.getVersion(),
                entity.isActive(),
                entity.getCreatedAt());
    }
}
