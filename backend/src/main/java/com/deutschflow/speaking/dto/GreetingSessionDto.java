package com.deutschflow.speaking.dto;

import java.time.LocalDateTime;

public record GreetingSessionDto(
        Long id,
        Long userId,
        Long templateId,
        Integer difficultyLevel,
        String aiPrompt,
        String aiResponse,
        String userInput,
        String feedback,
        Integer userConfidenceScore,
        String sessionStatus,
        LocalDateTime createdAt
) {}
