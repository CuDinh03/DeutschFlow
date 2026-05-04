package com.deutschflow.user.dto;

import java.time.LocalDateTime;

public record ReviewGradeResponse(
        long id,
        int quality,
        int repetitions,
        int intervalDays,
        double easeFactor,
        LocalDateTime nextDueAt
) {
}
