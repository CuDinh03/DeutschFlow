package com.deutschflow.interview.dto;

import java.math.BigDecimal;
import java.util.List;

public record InterviewReportDto(
        Long sessionId,
        String position,
        String experienceLevel,
        BigDecimal overallScore,
        String verdict,
        String readinessLevel,
        List<String> strongAreas,
        List<String> criticalGaps,
        List<String> recommendedDrills,
        List<PhaseResultDto> phaseResults
) {
    public record PhaseResultDto(
            String phase,
            BigDecimal score,
            List<String> strengths,
            List<String> weaknesses
    ) {}
}
