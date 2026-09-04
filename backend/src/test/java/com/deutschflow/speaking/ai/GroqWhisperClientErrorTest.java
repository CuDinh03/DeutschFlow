package com.deutschflow.speaking.ai;

import com.deutschflow.common.resilience.CircuitBreakers;
import com.deutschflow.speaking.config.GroqProperties;
import com.deutschflow.speaking.exception.AiErrorCode;
import com.deutschflow.speaking.exception.AiServiceException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Audit speaking 24/07 — R-B9 ghi "Whisper-error" là vùng trắng test, và bộ test này phát hiện
 * bản vá copy chưa tới nơi: #252 dọn câu chữ lộ vendor trong {@link GroqChatClient} nhưng
 * {@link GroqWhisperClient} vẫn ném nguyên "Whisper transcription failed: HTTP 500",
 * "Whisper verbose error: {message upstream}", "Groq API key is not configured." — tất cả đều
 * chảy thẳng vào {@code detail} của ProblemDetail 503 và hiện lên UI người học.
 *
 * <p>Chốt: mọi lỗi STT đều mang {@link AiErrorCode} máy-đọc-được + câu tiếng Việt trung tính.
 */
class GroqWhisperClientErrorTest {

    private static final String STT_MODEL = "whisper-large-v3";
    private static final byte[] AUDIO = "fake-audio-bytes".getBytes(StandardCharsets.UTF_8);

    private HttpServer server;
    private String endpointUrl;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        endpointUrl = "http://127.0.0.1:" + server.getAddress().getPort() + "/stt";
    }

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    @Test
    @DisplayName("upstream 5xx → AI_UPSTREAM_UNAVAILABLE, không lộ 'Whisper'/'HTTP 500'")
    void upstream5xxIsNeutralAndCoded() {
        respondWith(500, "{\"error\":\"internal\"}");

        assertThatThrownBy(() -> client().transcribe(AUDIO, "a.webm", "de", null))
                .isInstanceOfSatisfying(AiServiceException.class, ex -> {
                    assertThat(ex.getCode()).isEqualTo(AiErrorCode.AI_UPSTREAM_UNAVAILABLE);
                    assertThat(ex.getMessage())
                            .doesNotContain("Whisper").doesNotContain("Groq")
                            .doesNotContain("HTTP").doesNotContain("500");
                });
    }

    @Test
    @DisplayName("transcript rỗng → STT_FAILED kèm hướng dẫn hành động, không phải lỗi hệ thống")
    void emptyTranscriptIsSttFailed() {
        respondWith(200, "{\"text\":\"\"}");

        assertThatThrownBy(() -> client().transcribe(AUDIO, "a.webm", "de", null))
                .isInstanceOfSatisfying(AiServiceException.class, ex -> {
                    assertThat(ex.getCode()).isEqualTo(AiErrorCode.STT_FAILED);
                    assertThat(ex.getMessage()).contains("nói lại");
                });
    }

    @Test
    @DisplayName("lỗi truyền tải (server chết giữa chừng) → AI_UPSTREAM_UNAVAILABLE, không rò message gốc")
    void transportFailureDoesNotLeakUpstreamMessage() throws IOException {
        server.createContext("/stt", exchange -> exchange.close()); // đóng kết nối, không trả gì
        server.start();

        assertThatThrownBy(() -> client().transcribe(AUDIO, "a.webm", "de", null))
                .isInstanceOfSatisfying(AiServiceException.class, ex -> {
                    assertThat(ex.getCode()).isEqualTo(AiErrorCode.AI_UPSTREAM_UNAVAILABLE);
                    assertThat(ex.getMessage()).doesNotContain("Whisper").doesNotContain("Groq");
                });
    }

    @Test
    @DisplayName("thiếu API key → AI_NOT_CONFIGURED, không nêu tên nhà cung cấp")
    void missingApiKeyIsNotConfigured() {
        assertThatThrownBy(() -> client("").transcribe(AUDIO, "a.webm", "de", null))
                .isInstanceOfSatisfying(AiServiceException.class, ex -> {
                    assertThat(ex.getCode()).isEqualTo(AiErrorCode.AI_NOT_CONFIGURED);
                    assertThat(ex.getMessage()).doesNotContain("Groq").doesNotContain("API key");
                });
    }

    @Test
    @DisplayName("hết permit Whisper → AI_BUSY + Retry-After 15s, không gọi upstream")
    void semaphoreExhaustedIsBusyWithRetryAfter() throws Exception {
        respondWith(200, "{\"text\":\"hallo\"}");
        GroqProperties props = new GroqProperties();
        props.setMaxConcurrentWhisperRequests(1);
        props.setSemaphoreAcquireTimeoutSeconds(1);
        GroqConcurrencyLimiter limiter = new GroqConcurrencyLimiter(props);
        assertThat(limiter.tryAcquireWhisper()).isTrue(); // chiếm nốt permit duy nhất

        assertThatThrownBy(() -> client("test-key", limiter).transcribe(AUDIO, "a.webm", "de", null))
                .isInstanceOfSatisfying(AiServiceException.class, ex -> {
                    assertThat(ex.getCode()).isEqualTo(AiErrorCode.AI_BUSY);
                    assertThat(ex.getRetryAfterSeconds()).isEqualTo(15);
                });
    }

    @Test
    @DisplayName("verbose (chấm phát âm) dùng chung hợp đồng câu chữ với transcribe")
    void verbosePathIsAlsoNeutral() {
        respondWith(503, "{\"error\":\"upstream down\"}");

        assertThatThrownBy(() -> client().transcribeVerbose(AUDIO, "a.webm", "de", null))
                .isInstanceOfSatisfying(AiServiceException.class, ex -> {
                    assertThat(ex.getCode()).isEqualTo(AiErrorCode.AI_UPSTREAM_UNAVAILABLE);
                    assertThat(ex.getMessage()).doesNotContain("Whisper").doesNotContain("HTTP");
                });
    }

    // ── Hạn mức 429 (Đ6 04/08 — cùng khuôn chat #288/#291) ───────────────────

    @Test
    @DisplayName("429 → RATE_LIMITED + Retry-After của upstream, câu chữ trung tính")
    void rateLimit429IsClassifiedWithRetryAfter() {
        respondWith(429, "{\"error\":{\"message\":\"rate limit\"}}",
                java.util.Map.of("Retry-After", "45", "x-ratelimit-remaining-requests", "0"));

        assertThatThrownBy(() -> client().transcribe(AUDIO, "a.webm", "de", null))
                .isInstanceOfSatisfying(AiServiceException.class, ex -> {
                    assertThat(ex.getCode()).isEqualTo(AiErrorCode.RATE_LIMITED);
                    assertThat(ex.getRetryAfterSeconds()).isEqualTo(45);
                    assertThat(ex.getMessage())
                            .doesNotContain("Whisper").doesNotContain("Groq")
                            .doesNotContain("429").doesNotContain("rate limit");
                });
    }

    @Test
    @DisplayName("429 không kèm Retry-After → gợi ý mặc định 60s")
    void rateLimitWithoutHeaderGetsDefaultHint() {
        respondWith(429, "{\"error\":{\"message\":\"rate limit\"}}");

        assertThatThrownBy(() -> client().transcribeVerbose(AUDIO, "a.webm", "de", null))
                .isInstanceOfSatisfying(AiServiceException.class, ex -> {
                    assertThat(ex.getCode()).isEqualTo(AiErrorCode.RATE_LIMITED);
                    assertThat(ex.getRetryAfterSeconds()).isEqualTo(60);
                });
    }

    @Test
    @DisplayName("429 liên tiếp KHÔNG mở breaker groqWhisper — hạn mức không thành 503 toàn phần")
    void repeatedRateLimitsDoNotTripWhisperBreaker() {
        respondWith(429, "{\"error\":{\"message\":\"rate limit\"}}");
        GroqWhisperClient tightBreakerClient = clientWithBreakerOpeningAfter(2);

        for (int i = 0; i < 4; i++) {
            assertThatThrownBy(() -> tightBreakerClient.transcribe(AUDIO, "a.webm", "de", null))
                    .isInstanceOfSatisfying(AiServiceException.class, ex ->
                            // AI_BUSY = breaker OPEN (hành vi cũ) — 429 phải giữ nguyên RATE_LIMITED.
                            assertThat(ex.getCode()).isEqualTo(AiErrorCode.RATE_LIMITED));
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void respondWith(int status, String body) {
        respondWith(status, body, java.util.Map.of());
    }

    private void respondWith(int status, String body, java.util.Map<String, String> headers) {
        server.createContext("/stt", exchange -> {
            exchange.getRequestBody().readAllBytes();
            byte[] payload = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            headers.forEach((name, value) -> exchange.getResponseHeaders().add(name, value));
            exchange.sendResponseHeaders(status, payload.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(payload);
            }
        });
        server.start();
    }

    /** Breaker ngưỡng thấp nhất — hành vi cũ sẽ OPEN từ lượt 3 và trả AI_BUSY thay vì RATE_LIMITED. */
    private GroqWhisperClient clientWithBreakerOpeningAfter(int minimumCalls) {
        CircuitBreakers breakers = new CircuitBreakers(CircuitBreakerRegistry.of(
                CircuitBreakerConfig.custom()
                        .slidingWindowSize(Math.max(minimumCalls, 2))
                        .minimumNumberOfCalls(minimumCalls)
                        .failureRateThreshold(50f)
                        .waitDurationInOpenState(Duration.ofSeconds(30))
                        .build()));
        return new GroqWhisperClient("test-key", STT_MODEL, new ObjectMapper(),
                new GroqConcurrencyLimiter(new GroqProperties()), breakers, endpointUrl);
    }

    private GroqWhisperClient client() {
        return client("test-key");
    }

    private GroqWhisperClient client(String apiKey) {
        return client(apiKey, new GroqConcurrencyLimiter(new GroqProperties()));
    }

    private GroqWhisperClient client(String apiKey, GroqConcurrencyLimiter limiter) {
        CircuitBreakers breakers = new CircuitBreakers(CircuitBreakerRegistry.of(
                CircuitBreakerConfig.custom()
                        .slidingWindowSize(100)
                        .minimumNumberOfCalls(100)   // không để breaker mở giữa bộ test
                        .waitDurationInOpenState(Duration.ofSeconds(30))
                        .build()));
        return new GroqWhisperClient(apiKey, STT_MODEL, new ObjectMapper(),
                limiter, breakers, endpointUrl);
    }
}
