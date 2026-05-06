package com.deutschflow.speaking.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AiSpeakingChatRequest(
        @NotBlank(message = "userMessage must not be blank")
        @Size(max = 5000, message = "userMessage must not exceed 5000 characters")
        String userMessage
) {}
