package com.deutschflow.speaking.dto;

import java.time.LocalDateTime;

public record AiSpeakingMessageDto(
        Long id,
        String role,
        String userText,
        String aiSpeechDe,
        String correction,
        String explanationVi,
        String grammarPoint,
        String newWord,
        String userInterestDetected,
        LocalDateTime createdAt
) {}
