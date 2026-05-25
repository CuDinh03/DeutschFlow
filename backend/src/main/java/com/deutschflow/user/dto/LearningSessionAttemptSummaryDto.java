package com.deutschflow.user.dto;

import java.time.LocalDateTime;

public record LearningSessionAttemptSummaryDto(
        long id,
        int weekNumber,
        int sessionIndex,
        int attemptNo,
        int scorePercent,
        LocalDateTime createdAt,
        Integer mistakeCount
) {
}
