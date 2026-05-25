package com.deutschflow.speaking.dto;

import java.time.LocalDateTime;

public record ErrorReviewTaskDto(
        long id,
        String errorCode,
        String taskType,
        LocalDateTime dueAt,
        int intervalDays
) {
}
