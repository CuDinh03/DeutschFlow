package com.deutschflow.speaking.metrics;

import com.deutschflow.speaking.ai.AiParseStatus;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SpeakingMetricsTest {

    private MeterRegistry registry;
    private SpeakingMetrics speakingMetrics;

    @BeforeEach
    void setUp() {
        registry = new SimpleMeterRegistry();
        speakingMetrics = new SpeakingMetrics(registry);
    }

    @Test
    void recordAiParseOutcome_recordsCounterSpeakingAiParsePerTag() {
        speakingMetrics.recordAiParseOutcome(AiParseStatus.STRUCTURED);
        speakingMetrics.recordAiParseOutcome(AiParseStatus.FALLBACK_PARSE_ERROR);
        speakingMetrics.recordAiParseOutcome(AiParseStatus.FALLBACK_PARSE_ERROR);
        speakingMetrics.recordAiParseOutcome(AiParseStatus.FALLBACK_MISSING_AI_SPEECH);

        assertThat(registry.counter("speaking.ai_parse", "status", "structured").count())
                .isEqualTo(1.0);
        assertThat(registry.counter("speaking.ai_parse", "status", "fallback_parse_error").count())
                .isEqualTo(2.0);
        assertThat(registry.counter("speaking.ai_parse", "status", "fallback_missing_ai_speech").count())
                .isEqualTo(1.0);
    }

    @Test
    void recordAiParseOutcome_nullIgnored() {
        speakingMetrics.recordAiParseOutcome(null);
        assertThat(registry.getMeters().stream().map(m -> m.getId().getName()))
                .noneMatch("speaking.ai_parse"::equals);
    }
}
