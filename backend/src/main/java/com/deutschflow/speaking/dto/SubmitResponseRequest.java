package com.deutschflow.speaking.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** Self-rated confidence is 1..5, same scale as the client's slider. */
public record SubmitResponseRequest(
        @NotBlank String userInput,
        @NotNull @Min(1) @Max(5) Integer confidence
) {}
