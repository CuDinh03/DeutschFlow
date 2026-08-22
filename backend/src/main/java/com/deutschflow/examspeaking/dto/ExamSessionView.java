package com.deutschflow.examspeaking.dto;

import java.time.Instant;
import java.util.Map;

/** Snapshot phiên (server là nguồn sự thật; client chỉ render). */
public record ExamSessionView(
        long id,
        String provider,
        String level,
        String mode,
        String state,
        int currentPart,
        int currentStep,
        int totalParts,
        Instant serverNow,
        Instant prepDeadlineAt,
        Instant partDeadlineAt,
        Directive directive,
        Map<String, Object> lastTurnEval,
        String notesText,
        Long gradingJobId,
        boolean resultAvailable
) {
    public record Directive(
            int teilNo,
            String title,
            String archetype,
            int stepIndex,
            int stepCount,
            String candidateAction,
            String hintVi,
            Map<String, Object> stimulus,
            String prueferText,
            String prueferVoice,
            String lastAiRole,
            String lastAiText
    ) {}
}
