package com.deutschflow.speaking.dto;

import jakarta.validation.constraints.NotNull;

public record CompleteReviewTaskRequest(
        @NotNull Boolean passed
) {
}
