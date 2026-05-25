package com.deutschflow.user.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record SessionCompleteRequest(
        @NotNull(message = "week is required")
        @Min(value = 1, message = "week must be >= 1")
        Integer week,

        @NotNull(message = "sessionIndex is required")
        @Min(value = 1, message = "sessionIndex must be >= 1")
        Integer sessionIndex,

        Double abilityScore,

        @Min(value = 1, message = "timeSeconds must be >= 1")
        Double timeSeconds
) {}

