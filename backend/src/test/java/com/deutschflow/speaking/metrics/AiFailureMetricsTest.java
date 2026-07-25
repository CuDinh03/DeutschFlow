package com.deutschflow.speaking.metrics;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Audit speaking 24/07 — R-M6 / §7.6: đêm 23/07 prod 503 hàng loạt mà KHÔNG AI BIẾT cho tới khi
 * người dùng chụp màn hình gửi. {@code http.server.requests{status=503}} có sẵn của Spring Boot chỉ
 * nói CÓ 503; counter này nói VÌ SAO — nghẽn cục bộ (AI_BUSY), upstream chết
 * (AI_UPSTREAM_UNAVAILABLE) hay chưa cấu hình (AI_NOT_CONFIGURED) là ba sự cố khác nhau, ba cách xử
 * lý khác nhau, nên phải đặt được cảnh báo riêng.
 */
class AiFailureMetricsTest {

    private final MeterRegistry registry = new SimpleMeterRegistry();
    private final SpeakingMetrics metrics = new SpeakingMetrics(registry);

    @Test
    @DisplayName("đếm tách theo mã lỗi — mỗi mã một cách xử lý khác nhau")
    void countsPerErrorCode() {
        metrics.recordAiFailure("AI_BUSY", "/api/ai-speaking/sessions/{id}/chat");
        metrics.recordAiFailure("AI_BUSY", "/api/ai-speaking/sessions/{id}/chat");
        metrics.recordAiFailure("AI_UPSTREAM_UNAVAILABLE", "/api/ai-speaking/sessions/{id}/chat");

        assertThat(count("AI_BUSY", "/api/ai-speaking/sessions/{id}/chat")).isEqualTo(2);
        assertThat(count("AI_UPSTREAM_UNAVAILABLE", "/api/ai-speaking/sessions/{id}/chat")).isEqualTo(1);
    }

    @Test
    @DisplayName("thiếu mã / thiếu endpoint vẫn đếm được, không rơi mất mẫu")
    void nullsBecomeUnknownInsteadOfDroppingTheSample() {
        metrics.recordAiFailure(null, null);

        assertThat(count("unknown", "unknown")).isEqualTo(1);
    }

    private double count(String code, String endpoint) {
        var counter = registry.find("speaking.ai.failures")
                .tag("code", code).tag("endpoint", endpoint).counter();
        return counter == null ? 0 : counter.count();
    }
}
