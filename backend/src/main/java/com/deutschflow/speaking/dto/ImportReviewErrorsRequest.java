package com.deutschflow.speaking.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record ImportReviewErrorsRequest(
        @NotEmpty List<String> errors
) {
}
