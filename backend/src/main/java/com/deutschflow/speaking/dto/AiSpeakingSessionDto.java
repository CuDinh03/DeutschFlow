package com.deutschflow.speaking.dto;

import java.time.LocalDateTime;

public record AiSpeakingSessionDto(
        Long id,
        String topic,
        String cefrLevel,
        String persona,
        String responseSchema,
        String sessionMode,
        String status,
        LocalDateTime startedAt,
        LocalDateTime lastActivityAt,
        LocalDateTime endedAt,
        int messageCount,
        AiSpeakingChatResponse initialAiMessage,
        /** Interview mode only: position applied for. */
        String interviewPosition,
        /** Interview mode only: candidate experience level. */
        String experienceLevel,
        /** Interview mode only: JSON evaluation report (populated on endSession). */
        String interviewReportJson
) {}
