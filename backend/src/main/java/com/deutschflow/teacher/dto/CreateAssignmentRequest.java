package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;

public record CreateAssignmentRequest(
        String topic,
        String description,
        String assignmentType,
        /** German-skill tag: HOREN | LESEN | SCHREIBEN | SPRECHEN | GENERAL */
        String skill,
        Long referenceId,
        LocalDateTime dueDate,
        String attachmentUrl,
        /** Optional link to a ClassLesson in the same class (Phase 1d-D1). */
        Long lessonId
) {}
