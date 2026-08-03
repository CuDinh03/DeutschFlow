package com.deutschflow.speaking.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/** Difficulty is 1..5; {@code <= 2} maps to CEFR A1, otherwise A2 (see GreetingService). */
public record CreateGreetingSessionRequest(
        @NotNull Long templateId,
        @NotNull @Min(1) @Max(5) Integer difficultyLevel
) {}
