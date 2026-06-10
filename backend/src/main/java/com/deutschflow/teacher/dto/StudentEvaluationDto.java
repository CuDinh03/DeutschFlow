package com.deutschflow.teacher.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record StudentEvaluationDto(
        Long studentId,
        String name,
        String email,
        Long classId,
        String className,
        String teacherComment,
        BigDecimal skillHoren,
        BigDecimal skillLesen,
        BigDecimal skillSchreiben,
        BigDecimal skillSprechen,
        Double avgScore,
        int totalSessions,
        int presentCount,
        int absentCount,
        int lateCount,
        boolean certificateEligible,
        LocalDateTime evaluatedAt
) {}
