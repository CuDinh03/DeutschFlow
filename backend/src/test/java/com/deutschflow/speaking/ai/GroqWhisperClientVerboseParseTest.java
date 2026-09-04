package com.deutschflow.speaking.ai;

import com.deutschflow.common.resilience.CircuitBreakers;
import com.deutschflow.speaking.config.GroqProperties;
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
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Portability STT đa nhà cung cấp (bench Fireworks 08/08/2026). Hai khác biệt wire-format phải
 * được client san phẳng để {@code PronunciationScorerService} không biết gì về provider:
 *
 * <ul>
 *   <li><b>Confidence</b>: Groq trả {@code segments[].avg_logprob}; Fireworks KHÔNG có
 *       {@code segments} mà trả {@code words[].probability} — client suy avg_logprob = trung bình
 *       ln(p) để giữ nguyên thang calibration điểm phát âm.</li>
 *   <li><b>Prompt</b>: Fireworks decode {@code prompt} theo semantics gốc Whisper ("văn bản đứng
 *       TRƯỚC audio") — prompt trùng nội dung audio làm phần trùng BIẾN MẤT khỏi transcript (đo
 *       thật: câu đầu bị nuốt nguyên vẹn). Học viên đọc đúng câu mẫu sẽ bị chấm MISSING toàn bộ,
 *       nên client phải bỏ được field prompt qua cờ {@code whisper-prompt-enabled}.</li>
 * </ul>
 */
class GroqWhisperClientVerboseParseTest {

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
    @DisplayName("dạng Groq (có segments) → avg_logprob lấy từ segments, words giữ nguyên")
    void groqShapeUsesSegmentAvgLogprob() {
        respondWith("""
                {"text": " Hallo Welt ", "duration": 2.5,
                 "segments": [{"avg_logprob": -0.25}, {"avg_logprob": -0.35}],
                 "words": [{"word": " Hallo", "start": 0.1, "end": 0.5},
                           {"word": "Welt ", "start": 0.6, "end": 1.0}]}
                """);

        GroqWhisperClient.VerboseTranscript vt =
                client(true).transcribeVerbose(AUDIO, "a.webm", "de", null);

        assertThat(vt.text()).isEqualTo("Hallo Welt");
        assertThat(vt.durationSeconds()).isEqualTo(2.5);
        assertThat(vt.avgLogprob()).isCloseTo(-0.3, within(1e-9));
        assertThat(vt.words()).extracting(GroqWhisperClient.WordTimestamp::word)
                .containsExactly("Hallo", "Welt");
    }

    @Test
    @DisplayName("dạng Fireworks (không segments, words có probability) → avg_logprob = trung bình ln(p)")
    void fireworksShapeDerivesAvgLogprobFromWordProbabilities() {
        double p1 = Math.exp(-0.1);
        double p2 = Math.exp(-0.2);
        respondWith("""
                {"text": "Am Samstag", "duration": 10.1,
                 "words": [{"word": "Am", "start": 0.04, "end": 0.14, "probability": %s, "hallucination_score": 0.0},
                           {"word": "Samstag", "start": 0.22, "end": 0.76, "probability": %s, "hallucination_score": 0.0}]}
                """.formatted(p1, p2));

        GroqWhisperClient.VerboseTranscript vt =
                client(true).transcribeVerbose(AUDIO, "a.webm", "de", null);

        assertThat(vt.avgLogprob())
                .isCloseTo((Math.log(p1) + Math.log(p2)) / 2, within(1e-9));
        assertThat(vt.words()).hasSize(2);
        assertThat(vt.words().get(0).start()).isEqualTo(0.04);
    }

    @Test
    @DisplayName("không segments, words cũng không probability → giữ mặc định -0.3, không NaN")
    void noSegmentsNoProbabilitiesFallsBackToDefault() {
        respondWith("""
                {"text": "Hallo", "duration": 1.0,
                 "words": [{"word": "Hallo", "start": 0.0, "end": 0.5}]}
                """);

        GroqWhisperClient.VerboseTranscript vt =
                client(true).transcribeVerbose(AUDIO, "a.webm", "de", null);

        assertThat(vt.avgLogprob()).isCloseTo(-0.3, within(1e-9));
    }

    @Test
    @DisplayName("whisper-prompt-enabled=true (mặc định Groq) → body multipart CÓ field prompt")
    void promptSentWhenEnabled() {
        AtomicReference<String> requestBody = captureRequestBody();

        client(true).transcribeVerbose(AUDIO, "a.webm", "de", "Der Zielsatz");

        assertThat(requestBody.get()).contains("name=\"prompt\"").contains("Der Zielsatz");
    }

    @Test
    @DisplayName("whisper-prompt-enabled=false (Fireworks) → body multipart KHÔNG có field prompt")
    void promptOmittedWhenDisabled() {
        AtomicReference<String> requestBody = captureRequestBody();

        client(false).transcribeVerbose(AUDIO, "a.webm", "de", "Der Zielsatz");

        assertThat(requestBody.get()).doesNotContain("name=\"prompt\"").doesNotContain("Der Zielsatz");
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void respondWith(String body) {
        server.createContext("/stt", exchange -> {
            exchange.getRequestBody().readAllBytes();
            byte[] payload = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, payload.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(payload);
            }
        });
        server.start();
    }

    /** Stub 200 tối thiểu, lưu lại body request (đọc ISO-8859-1 để phần text multipart soi được). */
    private AtomicReference<String> captureRequestBody() {
        AtomicReference<String> captured = new AtomicReference<>();
        server.createContext("/stt", exchange -> {
            captured.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.ISO_8859_1));
            byte[] payload = "{\"text\": \"ok\", \"duration\": 1.0}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, payload.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(payload);
            }
        });
        server.start();
        return captured;
    }

    private GroqWhisperClient client(boolean promptEnabled) {
        CircuitBreakers breakers = new CircuitBreakers(CircuitBreakerRegistry.of(
                CircuitBreakerConfig.custom()
                        .slidingWindowSize(100)
                        .minimumNumberOfCalls(100)   // không để breaker mở giữa bộ test
                        .waitDurationInOpenState(Duration.ofSeconds(30))
                        .build()));
        return new GroqWhisperClient("test-key", STT_MODEL, new ObjectMapper(),
                new GroqConcurrencyLimiter(new GroqProperties()), breakers, endpointUrl, promptEnabled);
    }
}
