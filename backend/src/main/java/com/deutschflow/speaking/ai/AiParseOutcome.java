package com.deutschflow.speaking.ai;

/**
 * Parsed AI payload plus classifier for telemetry (Prometheus counters).
 */
public record AiParseOutcome(AiResponseDto dto, AiParseStatus status) {
}
