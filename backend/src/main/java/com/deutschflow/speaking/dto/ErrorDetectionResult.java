package com.deutschflow.speaking.dto;

import java.util.List;

public record ErrorDetectionResult(
        String originalText,
        String correctedText,
        String overallFeedback,
        List<ErrorItemDto> errors,
        int errorCount,
        String severity
) {}
