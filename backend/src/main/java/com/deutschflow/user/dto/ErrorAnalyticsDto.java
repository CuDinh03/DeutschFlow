package com.deutschflow.user.dto;

import java.util.List;
import java.util.Map;

public record ErrorAnalyticsDto(
        List<CommonErrorDto> mostCommonErrors,
        List<DailyErrorCountDto> errorTrend,
        List<WeakAreaDto> weakAreas,
        int totalErrorsThisWeek,
        int openErrors
) {
    public record CommonErrorDto(
            String errorCode,
            String label,
            long count,
            String exampleWrong,
            String exampleCorrect,
            String severity
    ) {}

    public record DailyErrorCountDto(
            String date,
            long errorCount
    ) {}

    public record WeakAreaDto(
            String grammarPoint,
            String label,
            long occurrences,
            String priority
    ) {}
}
