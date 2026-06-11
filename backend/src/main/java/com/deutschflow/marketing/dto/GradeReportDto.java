package com.deutschflow.marketing.dto;

import com.deutschflow.marketing.entity.SharedGradeReport;

import java.time.Instant;

/** Báo cáo chấm công khai (xem qua share token) — KHÔNG lộ PII. */
public record GradeReportDto(String topic, int score, String feedback, Instant createdAt) {
    public static GradeReportDto from(SharedGradeReport r) {
        return new GradeReportDto(r.getTopic(), r.getScore(), r.getFeedback(), r.getCreatedAt());
    }
}
