package com.deutschflow.speaking.ai;

import com.deutschflow.common.resilience.CircuitBreakers;
import com.deutschflow.speaking.config.GroqProperties;
import com.deutschflow.speaking.exception.AiErrorCode;
import com.deutschflow.speaking.exception.AiServiceException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Chuỗi dự phòng STT cùng nhà cung cấp: chính → dự phòng (ngay) → chờ {@code retry-after} ngắn rồi
 * chính lần nữa. Toàn bộ chạy với server HTTP giả cục bộ — KHÔNG có lời gọi nào tới nhà cung cấp thật,
 * nên dạng phản hồi 429 (header {@code retry-after} tính bằng giây) là giả định theo tài liệu.
 *
 * <p>Server giả mô phỏng đúng tình huống Groq: MỘT URL, phân biệt model bằng field {@code model} của
 * multipart; mỗi model có hàng phản hồi riêng (hết hàng → 200).
 */
class GroqWhisperClientFallbackTest {

    private static final String PRIMARY = "whisper-large-v3-turbo";
    private static final String FALLBACK = "whisper-large-v3";
    private static final byte[] AUDIO = "fake-audio-bytes".getBytes(StandardCharsets.UTF_8);
    private static final String OK_BODY = """
            {"text": " Guten Morgen ", "duration": 2.0,
             "segments": [{"avg_logprob": -0.2}],
             "words": [{"word": "Guten", "start": 0.0, "end": 0.4}, {"word": "Morgen", "start": 0.5, "end": 0.9}]}
            """;

    private record Scripted(int status, String body, Map<String, String> headers) {}

    private HttpServer server;
    private String url;
    private final Map<String, Deque<Scripted>> scripts = new ConcurrentHashMap<>();
    /** Model của từng lời gọi HTTP, theo thứ tự tới server. */
    private final List<String> calls = new CopyOnWriteArrayList<>();
    private SimpleMeterRegistry meters;

    @BeforeEach
    void startServer() throws IOException {
        meters = new SimpleMeterRegistry();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        url = "http://127.0.0.1:" + server.getAddress().getPort() + "/stt";
        server.createContext("/", exchange -> {
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.ISO_8859_1);
            String model = body.contains(PRIMARY + "\r\n") ? PRIMARY
                    : body.contains(FALLBACK + "\r\n") ? FALLBACK : "other";
            calls.add(exchange.getRequestURI().getPath().equals("/stt") ? model : exchange.getRequestURI().getPath() + ":" + model);
            Scripted next;
            synchronized (scripts) {
                Deque<Scripted> queue = scripts.get(model);
                next = queue == null || queue.isEmpty() ? new Scripted(200, OK_BODY, Map.of()) : queue.poll();
            }
            byte[] payload = next.body().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            next.headers().forEach((k, v) -> exchange.getResponseHeaders().add(k, v));
            exchange.sendResponseHeaders(next.status(), payload.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(payload);
            }
        });
        server.start();
    }

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    @Test
    @DisplayName("chính 200 → không gọi dự phòng; kết quả mang tên model chính")
    void primaryOkNeverCallsFallback() {
        GroqWhisperClient.TranscribeResult result = client().transcribe(AUDIO, "a.webm", "de", null);

        assertThat(result.text()).isEqualTo("Guten Morgen");
        assertThat(result.model()).isEqualTo(PRIMARY);
        assertThat(calls).containsExactly(PRIMARY);
        assertThat(meters.find("speaking.stt.fallback").counters()).isEmpty();
    }

    @Test
    @DisplayName("chính 429 → dự phòng 200 NGAY (không chờ): 2 lời gọi, kết quả mang tên model dự phòng")
    void primary429FallsBackImmediately() {
        script(PRIMARY, 429, Map.of("retry-after", "1"));

        long start = System.nanoTime();
        GroqWhisperClient.TranscribeResult result = client().transcribe(AUDIO, "a.webm", "de", null);
        long elapsedMs = (System.nanoTime() - start) / 1_000_000L;

        assertThat(result.text()).isEqualTo("Guten Morgen");
        assertThat(result.model()).isEqualTo(FALLBACK);
        assertThat(result.modelOr("x")).isEqualTo(FALLBACK);
        assertThat(calls).containsExactly(PRIMARY, FALLBACK);
        assertThat(elapsedMs).as("không được chờ retry-after trước khi chuyển dự phòng").isLessThan(900);
        assertThat(counter("speaking.stt.rate_limited", "model", PRIMARY)).isEqualTo(1.0);
        assertThat(counter("speaking.stt.fallback", "model", FALLBACK, "outcome", "success")).isEqualTo(1.0);
        assertThat(meters.find("speaking.stt.failures").counters()).isEmpty();
    }

    @Test
    @DisplayName("verbose (chấm phát âm): chính 503 → dự phòng 200, giữ mốc thời gian từng từ + tên model dự phòng")
    void verbosePathFallsBackOn5xx() {
        script(PRIMARY, 503, Map.of());

        GroqWhisperClient.VerboseTranscript vt = client().transcribeVerbose(AUDIO, "a.webm", "de", null);

        assertThat(vt.model()).isEqualTo(FALLBACK);
        assertThat(vt.words()).hasSize(2);
        assertThat(calls).containsExactly(PRIMARY, FALLBACK);
    }

    @Test
    @DisplayName("chính 429 + dự phòng 429 + retry-after: 1 → chờ ~1s rồi chính 200 (3 lời gọi)")
    void bothRateLimitedWaitsRetryAfterThenRetriesPrimary() {
        script(PRIMARY, 429, Map.of("retry-after", "1"));
        script(FALLBACK, 429, Map.of("retry-after", "30"));

        long start = System.nanoTime();
        GroqWhisperClient.TranscribeResult result = client().transcribe(AUDIO, "a.webm", "de", null);
        long elapsedMs = (System.nanoTime() - start) / 1_000_000L;

        assertThat(result.model()).isEqualTo(PRIMARY);
        assertThat(calls).containsExactly(PRIMARY, FALLBACK, PRIMARY);
        assertThat(elapsedMs).isBetween(900L, 5_000L);
        assertThat(counter("speaking.stt.rate_limited", "model", PRIMARY)).isEqualTo(1.0);
        assertThat(counter("speaking.stt.rate_limited", "model", FALLBACK)).isEqualTo(1.0);
        assertThat(counter("speaking.stt.fallback", "model", FALLBACK, "outcome", "failure")).isEqualTo(1.0);
    }

    @Test
    @DisplayName("cả ba lượt 429 → RATE_LIMITED như cũ (Retry-After nhỏ nhất), đúng 3 lời gọi, đếm thất bại hẳn")
    void allThreeFailKeepsRateLimitedContract() {
        script(PRIMARY, 429, Map.of("retry-after", "1"));
        script(FALLBACK, 429, Map.of("retry-after", "30"));
        script(PRIMARY, 429, Map.of("retry-after", "20"));

        assertThatThrownBy(() -> client().transcribe(AUDIO, "a.webm", "de", null))
                .isInstanceOfSatisfying(AiServiceException.class, ex -> {
                    assertThat(ex.getCode()).isEqualTo(AiErrorCode.RATE_LIMITED);
                    assertThat(ex.getRetryAfterSeconds()).isEqualTo(1);
                    assertThat(ex.getMessage()).doesNotContain("Whisper").doesNotContain("Groq").doesNotContain("429");
                });
        assertThat(calls).containsExactly(PRIMARY, FALLBACK, PRIMARY);
        assertThat(counter("speaking.stt.failures", "model", PRIMARY, "code", "RATE_LIMITED")).isEqualTo(1.0);
    }

    @Test
    @DisplayName("chính 5xx + dự phòng 5xx → AI_UPSTREAM_UNAVAILABLE như cũ, 2 lời gọi (không có bước chờ)")
    void bothUpstreamDownKeepsUpstreamUnavailable() {
        script(PRIMARY, 500, Map.of());
        script(FALLBACK, 503, Map.of());

        assertThatThrownBy(() -> client().transcribeVerbose(AUDIO, "a.webm", "de", null))
                .isInstanceOfSatisfying(AiServiceException.class, ex -> {
                    assertThat(ex.getCode()).isEqualTo(AiErrorCode.AI_UPSTREAM_UNAVAILABLE);
                    assertThat(ex.getMessage()).doesNotContain("Whisper").doesNotContain("HTTP");
                });
        assertThat(calls).containsExactly(PRIMARY, FALLBACK);
        assertThat(counter("speaking.stt.failures", "model", PRIMARY, "code", "AI_UPSTREAM_UNAVAILABLE")).isEqualTo(1.0);
    }

    @Test
    @DisplayName("retry-after vượt ngưỡng (45s > 1500ms) → KHÔNG ngủ, trả RATE_LIMITED ngay sau 2 lời gọi")
    void longRetryAfterDoesNotHoldTheThread() {
        script(PRIMARY, 429, Map.of("retry-after", "45"));
        script(FALLBACK, 429, Map.of("retry-after", "50"));

        long start = System.nanoTime();
        assertThatThrownBy(() -> client().transcribe(AUDIO, "a.webm", "de", null))
                .isInstanceOfSatisfying(AiServiceException.class, ex -> {
                    assertThat(ex.getCode()).isEqualTo(AiErrorCode.RATE_LIMITED);
                    assertThat(ex.getRetryAfterSeconds()).isEqualTo(45);
                });
        assertThat((System.nanoTime() - start) / 1_000_000L).isLessThan(900);
        assertThat(calls).containsExactly(PRIMARY, FALLBACK);
    }

    @Test
    @DisplayName("chính 429 nhưng dự phòng 5xx → không chờ thử lại (chỉ chờ khi dự phòng CŨNG 429); lỗi là RATE_LIMITED")
    void retryOnlyWhenFallbackAlsoRateLimited() {
        script(PRIMARY, 429, Map.of("retry-after", "1"));
        script(FALLBACK, 503, Map.of());

        assertThatThrownBy(() -> client().transcribe(AUDIO, "a.webm", "de", null))
                .isInstanceOfSatisfying(AiServiceException.class, ex ->
                        assertThat(ex.getCode()).isEqualTo(AiErrorCode.RATE_LIMITED));
        assertThat(calls).containsExactly(PRIMARY, FALLBACK);
    }

    @Test
    @DisplayName("không có dự phòng: chính 429 + retry-after ngắn → chờ rồi thử lại chính một lần")
    void noFallbackStillRetriesPrimaryOnce() {
        script(PRIMARY, 429, Map.of("retry-after", "1"));

        GroqWhisperClient.TranscribeResult result = client(url, null, 1500).transcribe(AUDIO, "a.webm", "de", null);

        assertThat(result.model()).isEqualTo(PRIMARY);
        assertThat(calls).containsExactly(PRIMARY, PRIMARY);
    }

    @Test
    @DisplayName("ngưỡng chờ = 0 → tắt hẳn bước chờ-thử-lại")
    void zeroThresholdDisablesRetry() {
        script(PRIMARY, 429, Map.of("retry-after", "1"));
        script(FALLBACK, 429, Map.of("retry-after", "1"));

        assertThatThrownBy(() -> client(url, new String[]{url, FALLBACK}, 0).transcribe(AUDIO, "a.webm", "de", null))
                .isInstanceOfSatisfying(AiServiceException.class, ex ->
                        assertThat(ex.getCode()).isEqualTo(AiErrorCode.RATE_LIMITED));
        assertThat(calls).containsExactly(PRIMARY, FALLBACK);
    }

    @Test
    @DisplayName("chính 400 (audio hỏng) → STT_FAILED, không gọi dự phòng, không đếm là dịch vụ hỏng")
    void badAudioNeverFallsBack() {
        script(PRIMARY, 400, Map.of());

        assertThatThrownBy(() -> client().transcribe(AUDIO, "a.webm", "de", null))
                .isInstanceOfSatisfying(AiServiceException.class, ex ->
                        assertThat(ex.getCode()).isEqualTo(AiErrorCode.STT_FAILED));
        assertThat(calls).containsExactly(PRIMARY);
        assertThat(meters.find("speaking.stt.failures").counters()).isEmpty();
    }

    @Test
    @DisplayName("401 với dự phòng CÙNG URL → không gọi dự phòng (cùng khoá, chắc chắn 401), lỗi như cũ")
    void authFailureSameUrlDoesNotFallBack() {
        script(PRIMARY, 401, Map.of());

        assertThatThrownBy(() -> client().transcribe(AUDIO, "a.webm", "de", null))
                .isInstanceOfSatisfying(AiServiceException.class, ex ->
                        assertThat(ex.getCode()).isEqualTo(AiErrorCode.AI_UPSTREAM_UNAVAILABLE));
        assertThat(calls).containsExactly(PRIMARY);
        assertThat(counter("speaking.stt.failures", "model", PRIMARY, "code", "AI_UPSTREAM_UNAVAILABLE")).isEqualTo(1.0);
    }

    @Test
    @DisplayName("403 với dự phòng ở URL KHÁC → vẫn thử dự phòng (host khác có thể lành)")
    void authFailureDifferentUrlStillFallsBack() {
        script(PRIMARY, 403, Map.of());
        String otherUrl = url.replace("/stt", "/other");

        GroqWhisperClient.TranscribeResult result =
                client(url, new String[]{otherUrl, FALLBACK}, 1500).transcribe(AUDIO, "a.webm", "de", null);

        assertThat(result.model()).isEqualTo(FALLBACK);
        assertThat(calls).containsExactly(PRIMARY, "/other:" + FALLBACK);
    }

    // ── Suy diễn / cấu hình dự phòng ─────────────────────────────────────────

    @Test
    @DisplayName("host Groq: whisper-large-v3-turbo ↔ whisper-large-v3 là dự phòng của nhau, cùng URL")
    void groqSiblingBothDirections() {
        String groq = GroqWhisperClient.WHISPER_URL;
        assertThat(GroqWhisperClient.resolveFallback(groq, "whisper-large-v3-turbo", "", ""))
                .containsExactly(groq, "whisper-large-v3");
        assertThat(GroqWhisperClient.resolveFallback(groq, "whisper-large-v3", null, null))
                .containsExactly(groq, "whisper-large-v3-turbo");
        assertThat(GroqWhisperClient.resolveFallback(groq, "distil-whisper-large-v3-en", "", "")).isNull();
    }

    @Test
    @DisplayName("host Fireworks giữ hành vi cũ; host lạ không có dự phòng")
    void otherHostsKeepLegacyBehaviour() {
        assertThat(GroqWhisperClient.resolveFallback(GroqWhisperClient.FIREWORKS_TURBO_URL, "whisper-v3-turbo", "", ""))
                .containsExactly("https://audio-prod.us-virginia-1.direct.fireworks.ai/v1/audio/transcriptions", "whisper-v3");
        assertThat(GroqWhisperClient.resolveFallback(url, "whisper-large-v3-turbo", "", "")).isNull();
        // tên miền chỉ CHỨA chuỗi api.groq.com thì không được coi là Groq
        assertThat(GroqWhisperClient.resolveFallback(
                "https://api.groq.com.example.test/openai/v1/audio/transcriptions", "whisper-large-v3", "", "")).isNull();
    }

    @Test
    @DisplayName("cấu hình tường minh thắng suy diễn; URL dự phòng rỗng = cùng URL với model chính")
    void explicitConfigWinsOverInference() {
        String groq = GroqWhisperClient.WHISPER_URL;
        assertThat(GroqWhisperClient.resolveFallback(groq, "whisper-large-v3-turbo", "mein-modell", ""))
                .containsExactly(groq, "mein-modell");
        assertThat(GroqWhisperClient.resolveFallback(groq, "whisper-large-v3-turbo", "mein-modell", "https://stt.example.test/v1/audio/transcriptions"))
                .containsExactly("https://stt.example.test/v1/audio/transcriptions", "mein-modell");
        assertThat(GroqWhisperClient.resolveFallback(groq, "whisper-large-v3-turbo", "", "https://stt.example.test/v1/audio/transcriptions"))
                .containsExactly("https://stt.example.test/v1/audio/transcriptions", "whisper-large-v3-turbo");
        // trùng hệt model chính → coi như không có dự phòng
        assertThat(GroqWhisperClient.resolveFallback(groq, "whisper-large-v3-turbo", "whisper-large-v3-turbo", "")).isNull();
    }

    @Test
    @DisplayName("constructor Spring: GROQ_WHISPER_FALLBACK_MODEL được dùng làm dự phòng trên cùng URL")
    void springConstructorHonoursExplicitFallbackModel() {
        script(PRIMARY, 429, Map.of());
        GroqWhisperClient c = new GroqWhisperClient("chat-key", "", PRIMARY, new ObjectMapper(),
                new GroqConcurrencyLimiter(new GroqProperties()), breakers(), url, "", FALLBACK, "", 1500L, null);

        assertThat(c.transcribe(AUDIO, "a.webm", "de", null).model()).isEqualTo(FALLBACK);
        assertThat(calls).containsExactly(PRIMARY, FALLBACK);
    }

    @Test
    @DisplayName("retry-after: số giây (kể cả thập phân) → ms; dạng ngày-giờ/âm/rỗng → null")
    void retryAfterParsing() {
        assertThat(GroqWhisperClient.parseRetryAfterMillis("1")).isEqualTo(1000L);
        assertThat(GroqWhisperClient.parseRetryAfterMillis(" 0.5 ")).isEqualTo(500L);
        assertThat(GroqWhisperClient.parseRetryAfterMillis("Wed, 21 Oct 2026 07:28:00 GMT")).isNull();
        assertThat(GroqWhisperClient.parseRetryAfterMillis("-1")).isNull();
        assertThat(GroqWhisperClient.parseRetryAfterMillis(null)).isNull();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void script(String model, int status, Map<String, String> headers) {
        String body = status == 200 ? OK_BODY : "{\"error\":{\"message\":\"stub " + status + "\"}}";
        synchronized (scripts) {
            scripts.computeIfAbsent(model, m -> new ArrayDeque<>()).add(new Scripted(status, body, headers));
        }
    }

    private double counter(String name, String... tags) {
        Counter c = meters.find(name).tags(tags).counter();
        return c == null ? 0.0 : c.count();
    }

    private static CircuitBreakers breakers() {
        return new CircuitBreakers(CircuitBreakerRegistry.of(
                CircuitBreakerConfig.custom()
                        .slidingWindowSize(100)
                        .minimumNumberOfCalls(100)   // không để breaker mở giữa bộ test
                        .waitDurationInOpenState(Duration.ofSeconds(30))
                        .build()));
    }

    /** Mặc định: cùng URL, dự phòng = model anh em — đúng hình dạng cấu hình Groq. */
    private GroqWhisperClient client() {
        return client(url, new String[]{url, FALLBACK}, 1500);
    }

    private GroqWhisperClient client(String primaryUrl, String[] fallback, long retryMaxWaitMs) {
        return new GroqWhisperClient("test-key", PRIMARY, new ObjectMapper(),
                new GroqConcurrencyLimiter(new GroqProperties()), breakers(), primaryUrl, true,
                fallback, retryMaxWaitMs, meters);
    }
}
