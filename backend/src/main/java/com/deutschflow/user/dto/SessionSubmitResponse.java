package com.deutschflow.user.dto;

import java.util.List;

public record SessionSubmitResponse(
        int scorePercent,
        boolean passed60,
        boolean completed,
        String mode,
        List<String> requiredExerciseIds,
        List<Mistake> mistakes,
        List<SessionDetailResponse.ExerciseItem> reinforcementExercises,
        /** Per-question outcome; {@link ItemResult#explanation()} is filled only when this attempt scored 100%. */
        List<ItemResult> itemResults,
        /** Present when {@link #completed()} and there is another session in the plan; otherwise null. */
        Integer nextWeek,
        Integer nextSessionIndex
) {
    public record Mistake(
            String exerciseId,
            /** MC / ORDER / TRUE_FALSE: option index; TEXT / SPEAK_REPEAT: -1 */
            int correctOptionIndex,
            Integer chosenOptionIndex,
            /** For TEXT/SPEECH answers */
            String chosenText
    ) {}

    public record ItemResult(
            String exerciseId,
            boolean correct,
            String explanation
    ) {}

    // reinforcementExercises uses the same ExerciseItem schema as session detail
}

