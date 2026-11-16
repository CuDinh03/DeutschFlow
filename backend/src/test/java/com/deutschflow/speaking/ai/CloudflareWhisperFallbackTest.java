package com.deutschflow.speaking.ai;

import com.deutschflow.common.resilience.CircuitBreakers;
import com.deutschflow.speaking.config.GroqProperties;
import com.deutschflow.speaking.exception.AiServiceException;
import com.fasterxml.jackson.databind.JsonNode;
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
import java.util.Base64;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Đường STT dự phòng khác nhà cung cấp (Cloudflare Workers AI). Chạy với MỘT server HTTP giả cục bộ
 * đóng cả hai vai: {@code /stt} là nhà cung cấp chính (trạng thái do test đặt), {@code /cf/...} là
 * Workers AI. KHÔNG có lời gọi nào tới Cloudflare thật — dạng phản hồi là theo tài liệu công khai,
 * hành vi thật chỉ xác nhận được khi bật trên máy chủ.
 */
class CloudflareWhisperFallbackTest {

    private static final String PRIMARY = "whisper-large-v3-turbo";
    private static final String SIBLING = "whisper-large-v3";
    private static final String CF_MODEL = "@cf/openai/whisper-large-v3-turbo";
    private static final byte[] AUDIO = "fake-audio-bytes".getBytes(StandardCharsets.UTF_8);
    private static final String GROQ_OK = """
            {"text": " Guten Morgen ", "duration": 2.0, "segments": [{"avg_logprob": -0.2}],
             "words": [{"word": "Guten", "start": 0.0, "end": 0.4}, {"word": "Morgen", "start": 0.5, "end": 0.9}]}
            """;
    private static final String CF_OK = """
            {"success": true, "errors": [], "messages": [],
             "result": {"text": " Guten Abend ",
                        "transcription_info": {"language": "de", "duration": 1.7},
                        "segments": [
                          {"avg_logprob": -0.1, "words": [{"word": " Guten", "start": 0.0, "end": 0.5}]},
                          {"avg_logprob": -0.3, "words": [{"word": " Abend", "start": 0.6, "end": 1.1}]}]}}
            """;

    private final ObjectMapper mapper = new ObjectMapper();
    private HttpServer server;
    private String sttUrl;
    private String cfBase;
    /** Trạng thái HTTP nhà cung cấp chính trả cho MỌI model. */
    private volatile int groqStatus = 200;
    private volatile int cfStatus = 200;
    private volatile String cfBody = CF_OK;
    /** Đường dẫn của từng lời gọi tới server, theo thứ tự. */
    private final List<String> calls = new CopyOnWriteArrayList<>();
    private volatile String lastCfAuth;
    private volatile String lastCfBody;
    private SimpleMeterRegistry meters;

    @BeforeEach
    void startServer() throws IOException {
        meters = new SimpleMeterRegistry();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        String origin = "http://127.0.0.1:" + server.getAddress().getPort();
        sttUrl = origin + "/stt";
        cfBase = origin + "/cf";
        server.createContext("/", exchange -> {
            String path = exchange.getRequestURI().getPath();
            String requestBody = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            int status;
            String body;
            if (path.startsWith("/cf/")) {
                calls.add("cf");
                lastCfAuth = exchange.getRequestHeaders().getFirst("Authorization");
                lastCfBody = requestBody;
                status = cfStatus;
                body = cfStatus == 200 ? cfBody : "{\"success\":false,\"errors\":[{\"message\":\"stub\"}]}";
            } else {
                calls.add(requestBody.contains(SIBLING + "\r\n") ? "groq:" + SIBLING : "groq:" + PRIMARY);
                status = groqStatus;
                body = groqStatus == 200 ? GROQ_OK : "{\"error\":{\"message\":\"stub\"}}";
            }
            byte[] payload = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, payload.length);
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
    @DisplayName("chưa đặt account id / token → TẮT: chính và dự phòng hỏng thì báo lỗi, không có lời gọi Cloudflare")
    void offByDefault() {
        groqStatus = 503;
        GroqWhisperClient client = groq(cloudflare("", ""));

        assertThatThrownBy(() -> client.transcribe(AUDIO, "a.webm", "de", null))
                .isInstanceOf(AiServiceException.class);
        assertThat(calls).containsExactly("groq:" + PRIMARY, "groq:" + SIBLING);
    }

    @Test
    @DisplayName("nhà cung cấp chính khoẻ → không bao giờ gọi Cloudflare")
    void notCalledWhenPrimaryWorks() {
        GroqWhisperClient.TranscribeResult result = groq(cloudflare("acc", "tok")).transcribe(AUDIO, "a.webm", "de", null);

        assertThat(result.model()).isEqualTo(PRIMARY);
        assertThat(calls).containsExactly("groq:" + PRIMARY);
    }

    @Test
    @DisplayName("chính 503 + dự phòng 503 → Cloudflare 200: kết quả mang text, thời lượng và tên model của Cloudflare")
    void usedWhenWholeProviderIsDown() throws Exception {
        groqStatus = 503;

        GroqWhisperClient.TranscribeResult result = groq(cloudflare("acc", "tok")).transcribe(AUDIO, "a.webm", "de", "Guten Abend");

        assertThat(calls).containsExactly("groq:" + PRIMARY, "groq:" + SIBLING, "cf");
        assertThat(result.text()).isEqualTo("Guten Abend");
        assertThat(result.durationSeconds()).isEqualTo(1.7);
        assertThat(result.model()).isEqualTo(CF_MODEL);
        assertThat(counter("speaking.stt.fallback", "provider", "cloudflare", "outcome", "success")).isEqualTo(1.0);

        assertThat(lastCfAuth).isEqualTo("Bearer tok");
        JsonNode sent = mapper.readTree(lastCfBody);
        assertThat(Base64.getDecoder().decode(sent.path("audio").asText())).isEqualTo(AUDIO);
        assertThat(sent.path("language").asText()).isEqualTo("de");
        assertThat(sent.has("initial_prompt")).as("prompt mặc định không gửi sang Cloudflare").isFalse();
    }

    @Test
    @DisplayName("chính 401 (khoá hỏng) → bỏ qua model anh em cùng URL, gọi thẳng Cloudflare")
    void usedWhenPrimaryKeyIsRejected() {
        groqStatus = 401;

        GroqWhisperClient.TranscribeResult result = groq(cloudflare("acc", "tok")).transcribe(AUDIO, "a.webm", "de", null);

        assertThat(result.model()).isEqualTo(CF_MODEL);
        assertThat(calls).containsExactly("groq:" + PRIMARY, "cf");
    }

    @Test
    @DisplayName("chính 400 (bản ghi âm hỏng) → không chuyển sang Cloudflare")
    void notUsedForBadAudio() {
        groqStatus = 400;

        assertThatThrownBy(() -> groq(cloudflare("acc", "tok")).transcribe(AUDIO, "a.webm", "de", null))
                .isInstanceOf(AiServiceException.class);
        assertThat(calls).doesNotContain("cf");
    }

    @Test
    @DisplayName("Cloudflare cũng hỏng → báo lỗi, đếm fallback failure, không lặp vô hạn")
    void cloudflareFailureSurfacesError() {
        groqStatus = 503;
        cfStatus = 500;

        assertThatThrownBy(() -> groq(cloudflare("acc", "tok")).transcribe(AUDIO, "a.webm", "de", null))
                .isInstanceOf(AiServiceException.class);
        assertThat(calls).containsExactly("groq:" + PRIMARY, "groq:" + SIBLING, "cf");
        assertThat(counter("speaking.stt.fallback", "provider", "cloudflare", "outcome", "failure")).isEqualTo(1.0);
    }

    @Test
    @DisplayName("verbose: mốc thời gian từng từ gộp từ segments[].words[], độ tin cậy là trung bình avg_logprob")
    void verboseFlattensSegmentWords() {
        groqStatus = 503;

        GroqWhisperClient.VerboseTranscript vt = groq(cloudflare("acc", "tok")).transcribeVerbose(AUDIO, "a.webm", "de", null);

        assertThat(vt.model()).isEqualTo(CF_MODEL);
        assertThat(vt.text()).isEqualTo("Guten Abend");
        assertThat(vt.words()).extracting(GroqWhisperClient.WordTimestamp::word).containsExactly("Guten", "Abend");
        assertThat(vt.words().get(1).start()).isEqualTo(0.6);
        assertThat(vt.avgLogprob()).isCloseTo(-0.2, org.assertj.core.data.Offset.offset(1e-9));
    }

    @Test
    @DisplayName("HTTP 200 nhưng success=false → coi là lỗi, không trả transcript rỗng")
    void successFalseIsAnError() {
        groqStatus = 503;
        cfBody = "{\"success\": false, \"errors\": [{\"code\": 7000}], \"result\": null}";

        assertThatThrownBy(() -> groq(cloudflare("acc", "tok")).transcribe(AUDIO, "a.webm", "de", null))
                .isInstanceOf(AiServiceException.class);
    }

    @Test
    @DisplayName("bật CF_AI_PROMPT_ENABLED → gửi initial_prompt")
    void promptSentOnlyWhenEnabled() throws Exception {
        CloudflareWhisperClient cf = new CloudflareWhisperClient("acc", "tok", "", 5, true, mapper, cfBase);

        cf.transcribe(AUDIO, "de", "Guten Abend");

        assertThat(mapper.readTree(lastCfBody).path("initial_prompt").asText()).isEqualTo("Guten Abend");
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private CloudflareWhisperClient cloudflare(String accountId, String token) {
        return new CloudflareWhisperClient(accountId, token, "", 5, false, mapper, cfBase);
    }

    private GroqWhisperClient groq(CloudflareWhisperClient cf) {
        return new GroqWhisperClient("test-key", PRIMARY, mapper,
                new GroqConcurrencyLimiter(new GroqProperties()), breakers(), sttUrl, true,
                new String[]{sttUrl, SIBLING}, 0, meters, cf);
    }

    private double counter(String name, String... tags) {
        Counter c = meters.find(name).tags(tags).counter();
        return c == null ? 0.0 : c.count();
    }

    private static CircuitBreakers breakers() {
        return new CircuitBreakers(CircuitBreakerRegistry.of(
                CircuitBreakerConfig.custom()
                        .slidingWindowSize(100)
                        .minimumNumberOfCalls(100)
                        .waitDurationInOpenState(Duration.ofSeconds(30))
                        .build()));
    }
}
