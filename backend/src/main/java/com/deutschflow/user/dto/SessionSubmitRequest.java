package com.deutschflow.user.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.Map;

public record SessionSubmitRequest(
        @NotNull(message = "week is required")
        @Min(value = 1, message = "week must be >= 1")
        Integer week,

        @NotNull(message = "sessionIndex is required")
        @Min(value = 1, message = "sessionIndex must be >= 1")
        Integer sessionIndex,

    /**
     * Values: integer index for MC/TRUE_FALSE/ORDER_MC, or string for TEXT/SPEAK_REPEAT (client sends JSON number or string).
     */
    @NotNull(message = "answers is required")
    Map<String, Object> answers,

        /**
         * Optional: when server returns a reinforcement set, client must resubmit using exactly these exerciseIds.
         */
        List<String> exerciseIds,

        /**
         * {@code THEORY_GATE}: grade only {@link SessionDetailResponse#theoryGateExercises()} (must be 100% to unlock main).
         * {@code MAIN} or null: main session exercises (and reinforcement when applicable).
         */
        String phase
) {}

