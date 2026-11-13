package com.deutschflow.speaking.ai;

import com.deutschflow.ai.tier.LlmProperties;
import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.ModelFailover;
import com.deutschflow.ai.tier.TierSpec;
import com.deutschflow.common.resilience.CircuitBreakers;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Chuyển model khi model chính không trả lời (owner chốt 13/11/2026). Máy chủ giả trả lời theo tên model
 * trong request: hành vi của từng model đặt trong {@link #behaviour}.
 */
@DisplayName("GroqChatClient — chuyển sang model dự phòng")
class GroqChatClientFailoverTest {

    private HttpServer server;
    private String baseUrl;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final List<String> calledModels = new CopyOnWriteArrayList<>();
    /** model → "ok" | "503" | "400" | "json_invalid" | "404". */
    private final Map<String, String> behaviour = new ConcurrentHashMap<>();

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort() + "/v1/chat/completions";
        server.createContext("/", exchange -> {
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            String model = objectMapper.readTree(body).path("model").asText();
            boolean stream = objectMapper.readTree(body).path("stream").asBoolean(false);
            calledModels.add(model);
            String mode = behaviour.getOrDefault(model, "ok");
            int status;
            String resp;
            String type = "application/json";
            switch (mode) {
                case "503" -> { status = 503; resp = "{\"error\":{\"message\":\"No capacity available for model\"}}"; }
                case "404" -> { status = 404; resp = "{\"error\":{\"message\":\"x\",\"code\":\"model_not_found\"}}"; }
                case "400" -> { status = 400; resp = "{\"error\":{\"message\":\"bad request\",\"code\":\"invalid_request_error\"}}"; }
                case "json_invalid" -> { status = 400; resp = "{\"error\":{\"message\":\"Failed to generate JSON.\",\"code\":\"json_validate_failed\"}}"; }
                default -> {
                    status = 200;
                    if (stream) {
                        type = "text/event-stream";
                        resp = "data: {\"choices\":[{\"delta\":{\"content\":\"hi " + model + "\"}}]}\n\ndata: [DONE]\n\n";
                    } else {
                        resp = "{\"choices\":[{\"message\":{\"content\":\"answer from " + model + "\"}}],"
                                + "\"usage\":{\"prompt_tokens\":1,\"completion_tokens\":1,\"total_tokens\":2}}";
                    }
                }
            }
            byte[] bytes = resp.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", type);
            exchange.sendResponseHeaders(status, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        });
        server.start();
    }

    @AfterEach
    void stop() {
        if (server != null) server.stop(0);
    }

    private TierSpec tier(String model, String... fallbacks) {
        return new TierSpec(LlmTier.EXPLAIN, model, null, null, null, null, null, null, "low", false, false,
                List.of(fallbacks));
    }

    @Test
    @DisplayName("model chính 503 ⇒ trả lời bằng model kế, model chính chỉ gọi một lần; lượt sau bỏ qua model chính")
    void failsOverAndSkipsCoolingModel() {
        behaviour.put("gemini", "503");
        GroqChatClient client = client(new ModelFailover(props(List.of(), 120)));

        AiChatCompletionResult r = client.chatCompletionForTier(messages(), tier("gemini", "gpt-oss", "grok"), 0.2, 100);
        assertThat(r.content()).isEqualTo("answer from gpt-oss");
        assertThat(calledModels).containsExactly("gemini", "gpt-oss");

        calledModels.clear();
        AiChatCompletionResult r2 = client.chatCompletionForTier(messages(), tier("gemini", "gpt-oss", "grok"), 0.2, 100);
        assertThat(r2.content()).isEqualTo("answer from gpt-oss");
        assertThat(calledModels).containsExactly("gpt-oss");
    }

    @Test
    @DisplayName("404 model_not_found ⇒ chuyển model")
    void modelNotFoundFailsOver() {
        behaviour.put("gone", "404");
        GroqChatClient client = client(new ModelFailover(props(List.of(), 120)));
        assertThat(client.chatCompletionForTier(messages(), tier("gone", "grok"), 0.2, 100).content())
                .isEqualTo("answer from grok");
    }

    @Test
    @DisplayName("400 do chính request ⇒ không chuyển model, báo lỗi ngay")
    void badRequestDoesNotFailOver() {
        behaviour.put("gemini", "400");
        GroqChatClient client = client(new ModelFailover(props(List.of(), 120)));
        assertThatThrownBy(() -> client.chatCompletionForTier(messages(), tier("gemini", "gpt-oss"), 0.2, 100))
                .isInstanceOf(AiServiceException.class);
        assertThat(calledModels).containsExactly("gemini");
    }

    @Test
    @DisplayName("JSON sinh hỏng ⇒ thử model kế nhưng KHÔNG bắt model chính nghỉ")
    void jsonGlitchSwitchesWithoutCooldown() {
        behaviour.put("gemini", "json_invalid");
        ModelFailover failover = new ModelFailover(props(List.of(), 120));
        GroqChatClient client = client(failover);
        assertThat(client.chatCompletionForTier(messages(), tier("gemini", "gpt-oss"), 0.2, 100).content())
                .isEqualTo("answer from gpt-oss");
        assertThat(failover.order(List.of("gemini", "gpt-oss"))).containsExactly("gemini", "gpt-oss");
    }

    @Test
    @DisplayName("mọi model đều 503 ⇒ báo lỗi; model cuối vẫn được thử lại như cũ")
    void allDownThrows() {
        behaviour.put("gemini", "503");
        behaviour.put("gpt-oss", "503");
        GroqChatClient client = client(new ModelFailover(props(List.of(), 120)));
        assertThatThrownBy(() -> client.chatCompletionForTier(messages(), tier("gemini", "gpt-oss"), 0.2, 100))
                .isInstanceOf(AiServiceException.class);
        assertThat(calledModels.get(0)).isEqualTo("gemini");
        assertThat(calledModels.stream().filter("gpt-oss"::equals).count()).isGreaterThan(1);
    }

    @Test
    @DisplayName("đường gọi cũ (không theo tầng) dùng danh sách dự phòng chung")
    void legacyPathUsesGlobalFallbacks() {
        behaviour.put("openai/gpt-oss-20b", "503");
        GroqChatClient client = client(new ModelFailover(props(List.of("grok"), 120)));
        assertThat(client.chatCompletion(messages(), (String) null, 0.2, 100).content()).isEqualTo("answer from grok");
    }

    @Test
    @DisplayName("không có ModelFailover ⇒ như cũ: chỉ thử lại model chính")
    void noFailoverBeanKeepsOldBehaviour() {
        behaviour.put("gemini", "503");
        GroqChatClient client = client(null);
        assertThatThrownBy(() -> client.chatCompletionForTier(messages(), tier("gemini", "gpt-oss"), 0.2, 100))
                .isInstanceOf(AiServiceException.class);
        assertThat(calledModels).containsOnly("gemini");
    }

    @Test
    @DisplayName("stream: model chính hỏng trước token đầu ⇒ stream bằng model kế")
    void streamFailsOverBeforeFirstToken() {
        behaviour.put("gemini", "503");
        GroqChatClient client = client(new ModelFailover(props(List.of(), 120)));
        List<String> tokens = new ArrayList<>();
        AtomicReference<AiChatCompletionResult> done = new AtomicReference<>();
        boolean ok = client.chatCompletionStreamForTier(messages(), tier("gemini", "grok"), 0.2, 100,
                tokens::add, done::set, null);
        assertThat(ok).isTrue();
        assertThat(String.join("", tokens)).isEqualTo("hi grok");
        assertThat(done.get().model()).isEqualTo("grok");
    }

    private static LlmProperties props(List<String> global, int cooldown) {
        LlmProperties p = new LlmProperties();
        p.setFallbackModels(new ArrayList<>(global));
        p.setFailoverCooldownSeconds(cooldown);
        return p;
    }

    private GroqChatClient client(ModelFailover failover) {
        var props = new com.deutschflow.speaking.config.GroqProperties();
        props.setMaxConcurrentChatRequests(5);
        props.setSemaphoreAcquireTimeoutSeconds(10);
        GroqChatClient c = new GroqChatClient("test-key", "openai/gpt-oss-20b", objectMapper,
                new GroqConcurrencyLimiter(props), breakers(), "low", baseUrl);
        if (failover != null) c.setModelFailover(failover);
        return c;
    }

    private CircuitBreakers breakers() {
        return new CircuitBreakers(CircuitBreakerRegistry.of(CircuitBreakerConfig.custom()
                .slidingWindowType(CircuitBreakerConfig.SlidingWindowType.COUNT_BASED)
                .slidingWindowSize(100)
                .minimumNumberOfCalls(100)
                .build()));
    }

    private List<ChatMessage> messages() {
        return List.of(new ChatMessage("system", "Antworte als JSON-Objekt."), new ChatMessage("user", "Hallo"));
    }
}
