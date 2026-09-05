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
        /** Khoảng điểm [totalLow, totalHigh] vắt qua ngưỡng đỗ — kết luận đỗ/trượt chưa chắc (F-17). */
        boolean borderline,
        Map<String, Object> scoreSheet,
        Instant createdAt
) {}
