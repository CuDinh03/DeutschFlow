package com.deutschflow.teacher.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class StudentPerformanceAnalyticsDto {
    private Long studentId;
    private String studentName;
    
    private Metrics preClassMetrics;
    private Metrics inClassMetrics;
    
    private List<String> topWeaknesses;
    private String aiAdvisoryReport;

    @Data
    @Builder
    public static class Metrics {
        private int totalAssignmentsCompleted;
        private double averageScore;
        private int totalSpeakingSessions;
        private double averageSpeakingScore;
    }
}
