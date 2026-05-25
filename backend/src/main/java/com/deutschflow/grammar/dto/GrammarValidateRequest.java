package com.deutschflow.grammar.dto;

import jakarta.validation.constraints.NotBlank;

public record GrammarValidateRequest(
        @NotBlank(message = "answer is required")
        String answer,
        @NotBlank(message = "expected is required")
        String expected,
        String joiner,
        String sessionType,
        String level
) {
}
