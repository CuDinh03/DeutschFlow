package com.deutschflow.examspeaking.dto;

import java.time.Instant;
import java.util.List;
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
        Integer prepSec,
        List<PrepMaterial> prepMaterials,
        Instant partDeadlineAt,
        Directive directive,
        Map<String, Object> lastTurnEval,
        String notesText,
        Long gradingJobId,
        boolean resultAvailable
) {
    /** Tài liệu chuẩn bị cho một Teil (chỉ phần thí sinh được xem; chọn 1 trong N nếu choiceRequired). */
    public record PrepMaterial(
            int teilNo,
            String title,
            String archetype,
            boolean choiceRequired,
            Integer chosenIndex,
            List<Map<String, Object>> stimuli
    ) {}

    public record Directive(
            int teilNo,
            String title,
            String archetype,
            int stepIndex,
            int stepCount,
            String candidateAction,
            String hintVi,
            String hintKey,
            Map<String, Object> stimulus,
            String prueferText,
            String prueferVoice,
            String lastAiRole,
            String lastAiText
    ) {}
}
