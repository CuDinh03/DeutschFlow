package com.deutschflow.interview.dto;

import com.deutschflow.interview.entity.InterviewTurn;

import java.time.LocalDateTime;

public record InterviewTurnDto(
        int turnIndex,
        String phase,
        String questionText,
        String userAnswer,
        String aiFollowUp,
        String directiveType,
        Integer latencyMs,
        LocalDateTime createdAt
) {
    public static InterviewTurnDto from(InterviewTurn entity) {
        return new InterviewTurnDto(
                entity.getTurnIndex(),
                entity.getPhase(),
                entity.getQuestionText(),
                entity.getUserAnswer(),
                entity.getAiFollowUp(),
                entity.getDirectiveType(),
                entity.getLatencyMs(),
                entity.getCreatedAt()
        );
    }
}
