package com.deutschflow.interview.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record InterviewAnalyticsSummaryDto(
        long totalSessions,
        long completedSessions,
        double completionRate,
        Map<String, Long> sessionsByIndustry,
        Map<String, Long> sessionsByPersona,
        Map<String, Double> avgScoreByIndustry,
        List<PhaseDropOff> phaseDropOff,
        Map<String, Long> variantDistribution,
        Map<String, Double> avgScoreByVariant
) {
    public record PhaseDropOff(String phase, long sessionsReached, double reachRate) {}
}
