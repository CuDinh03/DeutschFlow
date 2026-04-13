package com.deutschflow.user.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record AbilityScoreRequest(
        @NotNull(message = "items is required")
        List<Item> items,

        @NotNull(message = "timeSeconds is required")
        @Min(value = 1, message = "timeSeconds must be >= 1")
        Double timeSeconds
) {
    public record Item(
            @NotNull(message = "q is required")
            Double q,

            @NotNull(message = "w is required")
            Double w
    ) {}
}

