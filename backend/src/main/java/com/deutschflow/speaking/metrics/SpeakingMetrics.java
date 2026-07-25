package com.deutschflow.speaking.metrics;

import com.deutschflow.speaking.ai.AiParseStatus;
import com.deutschflow.speaking.ai.ErrorItem;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Component
public class SpeakingMetrics {

    private final MeterRegistry registry;

    public SpeakingMetrics(MeterRegistry registry) {
        this.registry = registry;
    }

    public void recordChatRequest(String kind, String status) {
        registry.counter("speaking.chat.requests", "kind", kind, "status", status).increment();
    }

    public void recordChatLatency(String kind, Duration duration) {
        registry.timer("speaking.chat.latency", "kind", kind)
                .record(duration.toMillis(), TimeUnit.MILLISECONDS);
    }

    /** One increment per assistant turn after {@link com.deutschflow.speaking.ai.AiResponseParser#parseWithOutcome}. */
    public void recordAiParseOutcome(AiParseStatus status) {
        if (status == null) {
            return;
        }
        registry.counter("speaking.ai_parse", "status", status.name().toLowerCase()).increment();
    }

    public void recordErrorsEmitted(List<ErrorItem> errors) {
        if (errors == null) {
            return;
        }
        for (ErrorItem e : errors) {
            String code = e.errorCode() != null ? e.errorCode() : "unknown";
            String sev = e.severity() != null ? e.severity() : "MINOR";
            registry.counter("speaking.errors.emitted", "error_code", code, "severity", sev).increment();
        }
    }

    public void recordRepairAttempt(int rowsUpdated) {
        String result = rowsUpdated > 0 ? "resolved" : "noop";
        registry.counter("speaking.repair.attempts", "result", result).increment();
    }

    public void recordTurnAccuracy(boolean noMajorOrBlocking) {
        registry.counter("speaking.turns.total").increment();
        if (noMajorOrBlocking) {
            registry.counter("speaking.turns.no_major").increment();
        }
    }

    public void recordPolicyFocusHit(String errorCode) {
        String code = errorCode != null ? errorCode : "unknown";
        registry.counter("speaking.policy.focus_hit", "error_code", code).increment();
    }

    public void recordPolicyDifficultyKnob(int knob) {
        registry.counter("speaking.policy.difficulty_knob", "knob", String.valueOf(knob)).increment();
    }

    public void recordForceRepair() {
        registry.counter("speaking.policy.force_repair").increment();
    }

    /**
     * Một lượt AI hỏng, đếm theo {@link com.deutschflow.speaking.exception.AiErrorCode}.
     *
     * <p>Audit speaking 24/07 (R-M6 / §7.6): đêm 23/07 không ai biết prod đang 503 hàng loạt cho tới
     * khi người dùng chụp màn hình gửi. {@code http.server.requests{status=503}} của Spring Boot chỉ
     * cho biết CÓ 503, không cho biết vì sao — nghẽn cục bộ (AI_BUSY), upstream chết
     * (AI_UPSTREAM_UNAVAILABLE) hay chưa cấu hình (AI_NOT_CONFIGURED) đòi ba cách xử lý khác nhau.
     * Counter này tách chúng ra để đặt cảnh báo đúng chỗ (ngưỡng xem runbook §Observability).
     *
     * @param code mã lỗi máy-đọc-được, đã có sẵn trên mọi AiServiceException
     * @param endpoint URI mẫu (không phải URI thật có id) để tránh nổ cardinality của Prometheus
     */
    public void recordAiFailure(String code, String endpoint) {
        registry.counter("speaking.ai.failures",
                "code", code == null ? "unknown" : code,
                "endpoint", endpoint == null ? "unknown" : endpoint).increment();
    }

    /**
     * A learner's grammar mistake failed to persist — the SRS review signal was LOST for this turn.
     * {@code kind} = "structured" | "legacy". Alert if this counter is ever non-trivial.
     */
    public void recordGrammarPersistFailure(String kind) {
        registry.counter("speaking.grammar_persist.failures", "kind", kind == null ? "unknown" : kind).increment();
    }
}
