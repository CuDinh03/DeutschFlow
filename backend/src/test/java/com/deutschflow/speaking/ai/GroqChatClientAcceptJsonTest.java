package com.deutschflow.speaking.ai;

import com.deutschflow.common.resilience.CircuitBreakers;
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
 * Sự cố 13/11/2026: cổng AI tự host (đổi env ngày 12/11) trả SSE khi {@code Accept} không có
 * {@code application/json} — mà RestClient mặc định gửi {@code text/plain, *}{@code /*} cho bộ đọc String ⇒ mọi
 * lượt gọi chặn hỏng "Failed to parse Groq response". Máy chủ giả dưới đây bắt chước đúng hành vi đó.
 */
@DisplayName("GroqChatClient — lượt chặn xin JSON và đọc được cả SSE")
class GroqChatClientAcceptJsonTest {

    private HttpServer server;
    private String baseUrl;
    private final List<String> accepts = new CopyOnWriteArrayList<>();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String JSON = """
            {"choices":[{"message":{"content":"{\\"ok\\":true}"}}],
             "usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}""";

    private static final String SSE = """
            data: {"choices":[{"index":0,"delta":{"role":"assistant"}}]}

            data: {"choices":[{"index":0,"delta":{"content":"{\\"ok\\":"}}]}

            data: {"choices":[{"index":0,"delta":{"content":"true}"}}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}

            data: [DONE]
            """;

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort() + "/v1/chat/completions";
    }

    @AfterEach
    void stop() {
        if (server != null) server.stop(0);
    }

    @Test
    @DisplayName("gửi Accept: application/json ⇒ cổng kiểu SSE-mặc-định vẫn trả JSON, đọc được")
    void sendsAcceptJson() {
        serve(false);
        AiChatCompletionResult r = client().chatCompletion(messages(), (String) null, 0.2, 100);
        assertThat(accepts.get(0)).contains("application/json").doesNotContain("text/plain");
        assertThat(r.content()).isEqualTo("{\"ok\":true}");
        assertThat(r.usage()).isNotNull();
    }

    @Test
    @DisplayName("cổng vẫn trả SSE ⇒ ghép delta.content + usage thành kết quả thường")
    void parsesSseBody() {
        serve(true);
        AiChatCompletionResult r = client().chatCompletion(messages(), (String) null, 0.2, 100);
        assertThat(r.content()).isEqualTo("{\"ok\":true}");
        assertThat(r.usage()).isNotNull();
    }

    @Test
    @DisplayName("thân JSON thường đi qua sseToCompletionJson nguyên vẹn")
    void plainJsonUntouched() throws Exception {
        assertThat(GroqChatClient.sseToCompletionJson(objectMapper, JSON)).isSameAs(JSON);
        assertThat(GroqChatClient.sseToCompletionJson(objectMapper, null)).isNull();
    }

    /** {@code alwaysSse}: luôn trả SSE; ngược lại chỉ trả SSE khi Accept thiếu application/json (như cổng thật). */
    private void serve(boolean alwaysSse) {
        server.createContext("/", exchange -> {
            exchange.getRequestBody().readAllBytes();
            String accept = String.valueOf(exchange.getRequestHeaders().getFirst("Accept"));
            accepts.add(accept);
            boolean sse = alwaysSse || !accept.contains("application/json");
            byte[] bytes = (sse ? SSE : JSON).getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", sse ? "text/event-stream" : "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        });
        server.start();
    }

    private GroqChatClient client() {
        var props = new com.deutschflow.speaking.config.GroqProperties();
        props.setMaxConcurrentChatRequests(5);
        props.setSemaphoreAcquireTimeoutSeconds(10);
        return new GroqChatClient("test-key", "openai/gpt-oss-20b", objectMapper,
                new GroqConcurrencyLimiter(props), breakers(), "low", baseUrl);
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
