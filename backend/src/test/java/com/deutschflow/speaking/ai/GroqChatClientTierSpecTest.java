package com.deutschflow.speaking.ai;

import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.TierSpec;
import com.deutschflow.common.resilience.CircuitBreakers;
import com.fasterxml.jackson.databind.JsonNode;
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
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Hợp đồng P1 của khung tier (plans/2026-08-07, khu vực A):
 *
 * <ol>
 *   <li>Đường CŨ (model string / null) — request body byte-for-byte NHƯ TRƯỚC: không provider,
 *       không usage, không session; reasoning_effort chỉ theo luật defaultModel.</li>
 *   <li>Đường TẦNG — serialize đúng những gì tier khai (provider.order, require_parameters,
 *       usage.include, reasoning_effort per-tier) và dùng đúng endpoint + API key của tier.</li>
 * </ol>
 *
 * Dùng máy chủ HTTP thật như {@link GroqChatClientResilienceTest} — hợp đồng đo bằng bytes trên
 * dây, không đọc mã nguồn.
 */
class GroqChatClientTierSpecTest {

    private HttpServer server;
    private HttpServer secondServer;
    private String baseUrl;

    private final List<String> receivedBodies = new CopyOnWriteArrayList<>();
    private final List<String> receivedAuth = new CopyOnWriteArrayList<>();
    private final List<String> secondServerBodies = new CopyOnWriteArrayList<>();

    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String OK_RESPONSE = """
            {"choices":[{"message":{"content":"{\\"ok\\":true}"}}],
             "usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}""";

    private static final String OK_RESPONSE_WITH_COST = """
            {"choices":[{"message":{"content":"{\\"ok\\":true}"}}],
             "usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15,"cost":0.000123}}""";

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort() + "/chat";
    }

    @AfterEach
    void stopServers() {
        if (server != null) server.stop(0);
        if (secondServer != null) secondServer.stop(0);
    }

    @Test
    @DisplayName("đường cũ (model=null): body giữ NGUYÊN bộ field lịch sử — không field nào của khung tier")
    void legacyPathBodyUnchanged() throws Exception {
        respondWith(server, receivedBodies, receivedAuth, OK_RESPONSE);
        GroqChatClient client = client();

        client.chatCompletion(messages(), (String) null, 0.7, 100);

        JsonNode body = objectMapper.readTree(receivedBodies.get(0));
        assertThat(body.fieldNames()).toIterable().containsExactlyInAnyOrder(
                "model", "temperature", "max_tokens", "response_format", "reasoning_effort", "messages");
        assertThat(body.path("model").asText()).isEqualTo("openai/gpt-oss-20b");
        assertThat(body.path("reasoning_effort").asText()).isEqualTo("low");
        assertThat(body.has("provider")).isFalse();
        assertThat(body.has("usage")).isFalse();
        assertThat(receivedAuth.get(0)).isEqualTo("Bearer test-key");
    }

    @Test
    @DisplayName("đường cũ (model chấm tường minh): KHÔNG dính reasoning_effort — luật lịch sử giữ nguyên")
    void legacyExplicitModelSkipsEffort() throws Exception {
        respondWith(server, receivedBodies, receivedAuth, OK_RESPONSE);
        GroqChatClient client = client();

        client.chatCompletion(messages(), "openai/gpt-oss-120b", 0.3, 800);

        JsonNode body = objectMapper.readTree(receivedBodies.get(0));
        assertThat(body.has("reasoning_effort")).isFalse();
        assertThat(body.path("model").asText()).isEqualTo("openai/gpt-oss-120b");
    }

    @Test
    @DisplayName("đường tầng: serialize provider.order/require_parameters/usage.include + effort của tier")
    void tierPathSerializesProviderPreferences() throws Exception {
        respondWith(server, receivedBodies, receivedAuth, OK_RESPONSE);
        GroqChatClient client = client();
        TierSpec tier = new TierSpec(LlmTier.CHAT_PAID, "openai/gpt-oss-120b", null, null,
                List.of("cerebras", "groq"), true, "throughput", List.of("fp8"),
                "low", false, true);

        client.chatCompletionForTier(messages(), tier, 0.7, 800);

        JsonNode body = objectMapper.readTree(receivedBodies.get(0));
        assertThat(body.path("model").asText()).isEqualTo("openai/gpt-oss-120b");
        assertThat(body.path("reasoning_effort").asText()).isEqualTo("low");
        assertThat(body.path("provider").path("order").get(0).asText()).isEqualTo("cerebras");
        assertThat(body.path("provider").path("require_parameters").asBoolean()).isTrue();
        assertThat(body.path("provider").path("sort").asText()).isEqualTo("throughput");
        assertThat(body.path("provider").path("quantizations").get(0).asText()).isEqualTo("fp8");
        assertThat(body.path("usage").path("include").asBoolean()).isTrue();
    }

    @Test
    @DisplayName("đường tầng tối giản (chỉ model): body y hệt đường cũ trừ reasoning_effort theo tier")
    void tierPathMinimalHasNoExtras() throws Exception {
        respondWith(server, receivedBodies, receivedAuth, OK_RESPONSE);
        GroqChatClient client = client();
        TierSpec tier = new TierSpec(LlmTier.GRADING_EXAM, "openai/gpt-oss-120b", null, null,
                null, null, null, null, null, false, false);

        client.chatCompletionForTier(messages(), tier, 0.3, 800);

        JsonNode body = objectMapper.readTree(receivedBodies.get(0));
        assertThat(body.fieldNames()).toIterable().containsExactlyInAnyOrder(
                "model", "temperature", "max_tokens", "response_format", "messages");
    }

    @Test
    @DisplayName("tier override base-url + api-key: request đi endpoint thứ hai với key riêng")
    void tierBaseUrlAndKeyOverride() throws Exception {
        respondWith(server, receivedBodies, receivedAuth, OK_RESPONSE);
        secondServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        List<String> secondAuth = new CopyOnWriteArrayList<>();
        respondWith(secondServer, secondServerBodies, secondAuth, OK_RESPONSE);
        String secondUrl = "http://127.0.0.1:" + secondServer.getAddress().getPort() + "/or";

        GroqChatClient client = client();
        TierSpec tier = new TierSpec(LlmTier.BATCH, "openai/gpt-oss-120b", secondUrl, "sk-or-key",
                null, null, null, null, null, false, false);

        client.chatCompletionForTier(messages(), tier, 0.2, 400);

        assertThat(receivedBodies).isEmpty();
        assertThat(secondServerBodies).hasSize(1);
        assertThat(secondAuth.get(0)).isEqualTo("Bearer sk-or-key");
    }

    @Test
    @DisplayName("usage.cost trong response (OpenRouter) → costUsd; Groq không có → null")
    void parsesActualCostWhenPresent() {
        java.util.concurrent.atomic.AtomicReference<String> responseHolder =
                respondWith(server, receivedBodies, receivedAuth, OK_RESPONSE_WITH_COST);
        GroqChatClient client = client();

        AiChatCompletionResult withCost = client.chatCompletion(messages(), (String) null, 0.7, 100);
        assertThat(withCost.costUsd()).isEqualTo(0.000123);

        responseHolder.set(OK_RESPONSE);
        AiChatCompletionResult withoutCost = client.chatCompletion(messages(), (String) null, 0.7, 100);
        assertThat(withoutCost.costUsd()).isNull();
    }

    // ── helpers (cùng pattern GroqChatClientResilienceTest) ─────────────────

    /** Đăng ký handler một lần; đổi response giữa chừng qua AtomicReference trả về. */
    private java.util.concurrent.atomic.AtomicReference<String> respondWith(
            HttpServer target, List<String> bodySink, List<String> authSink, String response) {
        var responseHolder = new java.util.concurrent.atomic.AtomicReference<>(response);
        target.createContext("/", exchange -> {
            bodySink.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            authSink.add(exchange.getRequestHeaders().getFirst("Authorization"));
            byte[] bytes = responseHolder.get().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        });
        target.start();
        return responseHolder;
    }

    private GroqChatClient client() {
        return new GroqChatClient("test-key", "openai/gpt-oss-20b", objectMapper,
                new GroqConcurrencyLimiter(limiterProps()), breakers(), "low", baseUrl);
    }

    private static com.deutschflow.speaking.config.GroqProperties limiterProps() {
        var props = new com.deutschflow.speaking.config.GroqProperties();
        props.setMaxConcurrentChatRequests(5);
        props.setSemaphoreAcquireTimeoutSeconds(10);
        return props;
    }

    private CircuitBreakers breakers() {
        return new CircuitBreakers(CircuitBreakerRegistry.of(CircuitBreakerConfig.custom()
                .slidingWindowType(CircuitBreakerConfig.SlidingWindowType.COUNT_BASED)
                .slidingWindowSize(100)
                .minimumNumberOfCalls(100)
                .build()));
    }

    private List<ChatMessage> messages() {
        return List.of(
                new ChatMessage("system", "Antworte als JSON-Objekt."),
                new ChatMessage("user", "Hallo"));
    }
}
