package com.deutschflow.speaking.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AiSpeakingChatRequest(
        @NotBlank(message = "userMessage must not be blank")
        @Size(max = 1000, message = "userMessage must not exceed 1000 characters")
        String userMessage
) {}
