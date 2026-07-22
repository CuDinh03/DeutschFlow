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
        /**
         * Số buổi CÓ GHI NHẬN điểm danh cho chính học viên này (PRESENT + LATE + ABSENT) — mẫu số
         * của tỉ lệ chuyên cần. Cố ý KHÔNG phải tổng số buổi của lớp: buổi diễn ra trước khi học
         * viên vào lớp, và buổi chỉ ghi chủ đề mà không điểm danh ai, đều không thuộc về họ.
         */
        int recordedSessions,
        int presentCount,
        int absentCount,
        int lateCount,
        boolean certificateEligible,
        LocalDateTime evaluatedAt
) {}
