package com.deutschflow.teacher.dto;

/** Student self-assessment of a can-do (Phase 2a). status ∈ NOT_STARTED|IN_PROGRESS|MASTERED. */
public record SetCompetencyRequest(
        String status
) {}
