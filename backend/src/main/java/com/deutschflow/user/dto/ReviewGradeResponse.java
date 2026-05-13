package com.deutschflow.user.dto;

import java.time.LocalDateTime;

public record ReviewGradeResponse(
        long id,
        int rating,
        int state,
        double difficulty,
        double stability,
        int lapses,
        int reps,
        LocalDateTime nextDueAt
) {
}
