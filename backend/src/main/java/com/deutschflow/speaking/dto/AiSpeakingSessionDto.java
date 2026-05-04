package com.deutschflow.speaking.dto;

import java.time.LocalDateTime;

public record AiSpeakingSessionDto(
        Long id,
        String topic,
        String cefrLevel,
        String persona,
        String responseSchema,
        String status,
        LocalDateTime startedAt,
        LocalDateTime lastActivityAt,
        LocalDateTime endedAt,
        int messageCount,
        AiSpeakingChatResponse initialAiMessage
) {}
