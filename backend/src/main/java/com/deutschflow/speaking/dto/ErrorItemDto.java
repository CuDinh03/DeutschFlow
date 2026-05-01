package com.deutschflow.speaking.dto;

/**
 * CamelCase JSON for structured errors (SSE {@code done} event + message history).
 */
public record ErrorItemDto(
        String errorCode,
        String severity,
        Double confidence,
        String wrongSpan,
        String correctedSpan,
        String ruleViShort,
        String exampleCorrectDe
) {}
