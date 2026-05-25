package com.deutschflow.aiimage.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record AiImageGenerateRequest(
        @NotBlank String prompt,
        @NotBlank String preset,
        @NotBlank String style,
        @NotBlank String size,
        @Min(1) int count
) {
}
