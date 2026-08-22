package com.deutschflow.examspeaking.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

public record ExamResultView(
        long sessionId,
        String provider,
        String level,
        int rubricVersion,
        BigDecimal total,
        BigDecimal totalLow,
        BigDecimal totalHigh,
        BigDecimal max,
        Boolean passed,
        Map<String, Object> scoreSheet,
        Instant createdAt
) {}
