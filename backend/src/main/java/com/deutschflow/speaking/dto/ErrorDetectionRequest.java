package com.deutschflow.speaking.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ErrorDetectionRequest(
        @NotBlank @Size(max = 2000) String text,
        String cefrLevel,
        Long sessionId
) {}
