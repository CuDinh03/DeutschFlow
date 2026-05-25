package com.deutschflow.user.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record ReviewGradeRequest(
        @Min(value = 0, message = "quality must be >= 0")
        @Max(value = 5, message = "quality must be <= 5")
        int quality
) {
}
