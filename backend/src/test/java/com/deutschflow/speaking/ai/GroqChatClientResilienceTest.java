package com.deutschflow.speaking.ai;

import com.deutschflow.common.resilience.CircuitBreakers;
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
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Vùng trắng test của audit speaking 24/07 (R-B9): lớp resilience chưa từng có test nào, và CẢ HAI
 * outage (17/07 model chết, 23/07 chùm 503) nằm gọn trong vùng đó.
 *
 * <p>Chốt hợp đồng thời gian của R-B1 bằng một máy chủ HTTP thật (JDK {@code HttpServer} — không kéo
 * thêm dependency test nào, chạy được cả khi build offline) thay vì đọc hằng số trong mã nguồn:
 * ai đó nâng {@code MAX_ATTEMPTS} về 5 hay bỏ trần deadline sẽ làm bộ test này đỏ.
 */
class GroqChatClientResilienceTest {

    private HttpServer server;
    private String baseUrl;

    /** Số request máy chủ thật sự nhận — cách duy nhất đo "retry mấy lần" mà không tin vào hằng số. */
    private final AtomicInteger requestCount = new AtomicInteger();
    private final List<String> receivedBodies = new CopyOnWriteArrayList<>();

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort() + "/chat";
    }

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    // ── Hợp đồng retry (R-B1) ────────────────────────────────────────────────

    @Test
    @DisplayName("5xx lặp lại: đúng 3 attempt rồi bỏ cuộc — không quay lại 5 attempt của trước audit")
    void retriesExactlyThreeTimesOn5xx() {
        respondWith(503, "{\"error\":{\"message\":\"upstream busy\"}}");
        GroqChatClient client = client();

        long startedAt = System.nanoTime();
        assertThatThrownBy(() -> client.chatCompletion(messages(), null, 0.7, 100))
                .isInstanceOf(AiServiceException.class);
        Duration elapsed = Duration.ofNanos(System.nanoTime() - startedAt);

        assertThat(requestCount.get()).isEqualTo(3);
        // backoff 2s + 4s thật sự xảy ra giữa các attempt…
        assertThat(elapsed).isGreaterThanOrEqualTo(Duration.ofMillis(5_800));
        // …nhưng tổng vẫn nằm dưới trần 20s/lượt — client mobile (45s) và web không bao giờ timeout trước.
        assertThat(elapsed).isLessThan(Duration.ofSeconds(20));
    }

    @Test
    @DisplayName("429 vẫn được retry (nghẽn tạm thời), khác hẳn 4xx khác")
    void retriesOn429() {
        respondWith(429, "{\"error\":{\"message\":\"rate limited\"}}");

        assertThatThrownBy(() -> client().chatCompletion(messages(), null, 0.7, 100))
                .isInstanceOf(AiServiceException.class);

        assertThat(requestCount.get()).isEqualTo(3);
    }

    @Test
    @DisplayName("4xx thường: KHÔNG retry — hỏng đầu vào thì thử lại bao nhiêu lần cũng vô ích")
    void doesNotRetryOnPlain4xx() {
        respondWith(400, "{\"error\":{\"message\":\"bad request\",\"code\":\"invalid_request_error\"}}");

        assertThatThrownBy(() -> client().chatCompletion(messages(), null, 0.7, 100))
                .isInstanceOf(AiServiceException.class);

        assertThat(requestCount.get()).isEqualTo(1);
    }

    @Test
    @DisplayName("400 json_validate_failed: ĐƯỢC retry và thành công ở attempt 2 — hồi quy greeting 29/07")
    void retriesOnJsonValidateFailedAndSucceeds() {
        // Đúng body Groq trả trên prod 29/07 khi gpt-oss-20b hết completion budget giữa chừng.
        respondWithSequence(
                new StubResponse(400, "{\"error\":{\"message\":\"Failed to generate JSON.\","
                        + "\"type\":\"invalid_request_error\",\"code\":\"json_validate_failed\","
                        + "\"failed_generation\":\"max completion tokens reached before generating a valid document\"}}"),
                new StubResponse(200, "{\"choices\":[{\"message\":{\"content\":\"{\\\"ai_speech_de\\\":\\\"Hallo\\\"}\"}}],"
                        + "\"usage\":{\"prompt_tokens\":1,\"completion_tokens\":1,\"total_tokens\":2}}"));

        var result = client().chatCompletion(messages(), null, 0.7, 100);

        assertThat(result).isNotNull();
        assertThat(requestCount.get()).isEqualTo(2);
    }

    @Test
    @DisplayName("400 json_validate_failed lặp cả 3 attempt: bỏ cuộc với AiServiceException, không lặp vô hạn")
    void jsonValidateFailedExhaustsRetriesThenFails() {
        respondWith(400, "{\"error\":{\"message\":\"Failed to generate JSON.\","
                + "\"code\":\"json_validate_failed\",\"failed_generation\":\"\"}}");

        assertThatThrownBy(() -> client().chatCompletion(messages(), null, 0.7, 100))
                .isInstanceOf(AiServiceException.class);

        assertThat(requestCount.get()).isEqualTo(3);
    }

    @Test
    @DisplayName("model bị khai tử (404 model_not_found): fail ngay 1 attempt — hồi quy outage 17/07")
    void doesNotRetryOnDecommissionedModel() {
        respondWith(404, "{\"error\":{\"message\":\"The model `x` does not exist or you do not have "
                + "access to it.\",\"type\":\"invalid_request_error\",\"code\":\"model_not_found\"}}");

        assertThatThrownBy(() -> client().chatCompletion(messages(), null, 0.7, 100))
                .isInstanceOf(AiServiceException.class);

        assertThat(requestCount.get()).isEqualTo(1);
    }

    // ── Hạn mức upstream 429 (sự cố 04/08: free tier 8000 TPM) ──────────────
    //
    // Trước bản vá này mọi 429 đều bị retry mù 3 lần rồi ném AI_UPSTREAM_UNAVAILABLE chung chung.
    // Hai hệ quả đã đo được trên prod: (1) khi bucket cần ~50s mới đầy mà ngân sách một lượt gọi chỉ
    // 20s thì retry CHẮC CHẮN trượt nhưng vẫn đốt hạn mức 1000 request/ngày; (2) không có tín hiệu
    // nào phân biệt "chạm trần tài khoản" với "upstream sập", nên phải gọi tay API Groq mới biết.

    @Test
    @DisplayName("429 báo chờ lâu hơn ngân sách lượt gọi: bỏ cuộc NGAY sau 1 request, không đốt thêm hạn mức")
    void rateLimitLongerThanDeadlineFailsFastWithoutRetrying() {
        // Retry-After 45s > trần 20s/lượt ⇒ retry không thể thành công.
        respondWithSequence(rateLimited("45"));

        assertThatThrownBy(() -> client().chatCompletion(messages(), null, 0.7, 100))
                .isInstanceOfSatisfying(AiServiceException.class, ex -> {
                    assertThat(ex.getCode()).isEqualTo(AiErrorCode.RATE_LIMITED);
                    assertThat(ex.getRetryAfterSeconds()).isEqualTo(45);
                });

        // Điểm mấu chốt: ĐÚNG 1 request. Hành vi cũ là 3.
        assertThat(requestCount.get()).isEqualTo(1);
    }

    @Test
    @DisplayName("429 báo chờ ngắn: nghe theo Retry-After rồi thử lại và thành công")
    void rateLimitWithinDeadlineWaitsThenRetries() {
        respondWithSequence(
                rateLimited("1"),
                new StubResponse(200, OK_JSON_RESPONSE));

        long startedAt = System.nanoTime();
        var result = client().chatCompletion(messages(), null, 0.7, 100);
        Duration elapsed = Duration.ofNanos(System.nanoTime() - startedAt);

        assertThat(result).isNotNull();
        assertThat(requestCount.get()).isEqualTo(2);
        // Chờ theo Retry-After (1s), KHÔNG phải backoff cố định 2s của nhánh 5xx.
        assertThat(elapsed).isGreaterThanOrEqualTo(Duration.ofMillis(900));
        assertThat(elapsed).isLessThan(Duration.ofMillis(1_900));
    }

    @Test
    @DisplayName("429 không kèm Retry-After: vẫn retry 3 lần, nhưng ném RATE_LIMITED + gợi ý mặc định 60s")
    void rateLimitWithoutHeaderStillClassifiedAsRateLimited() {
        respondWith(429, "{\"error\":{\"message\":\"rate limited\"}}");

        assertThatThrownBy(() -> client().chatCompletion(messages(), null, 0.7, 100))
                .isInstanceOfSatisfying(AiServiceException.class, ex -> {
                    // Mã riêng ⇒ GlobalExceptionHandler tự đếm speaking.ai.failures{code=RATE_LIMITED}
                    // và phát Retry-After. Trước đây lẫn vào AI_UPSTREAM_UNAVAILABLE nên vô hình.
                    assertThat(ex.getCode()).isEqualTo(AiErrorCode.RATE_LIMITED);
                    assertThat(ex.getRetryAfterSeconds()).isEqualTo(60);
                });

        assertThat(requestCount.get()).isEqualTo(3);
    }

    @Test
    @DisplayName("thông điệp hạn mức cũng trung tính — không lộ vendor cho người dùng cuối")
    void rateLimitMessageIsNeutral() {
        respondWithSequence(rateLimited("45"));

        assertThatThrownBy(() -> client().chatCompletion(messages(), null, 0.7, 100))
                .isInstanceOfSatisfying(AiServiceException.class, ex ->
                        assertThat(ex.getMessage())
                                .doesNotContain("Groq").doesNotContain("groq")
                                .doesNotContain("rate limit").doesNotContain("429"));
    }

    @Test
    @DisplayName("parse Retry-After: số phân số làm tròn LÊN, giá trị rác/thiếu ⇒ không có gợi ý")
    void parsesRetryAfterLeniently() {
        // Groq trả cả dạng phân số; làm tròn xuống là thử lại sớm và ăn thêm một 429.
        assertThat(GroqChatClient.parseRetryAfterSeconds("7.5")).isEqualTo(8);
        assertThat(GroqChatClient.parseRetryAfterSeconds("2")).isEqualTo(2);
        assertThat(GroqChatClient.parseRetryAfterSeconds("0.2")).isEqualTo(1);
        // RFC cho phép cả HTTP-date; ta không đoán mà coi như không có gợi ý.
        assertThat(GroqChatClient.parseRetryAfterSeconds("Wed, 21 Oct 2026 07:28:00 GMT")).isNull();
        assertThat(GroqChatClient.parseRetryAfterSeconds("-5")).isNull();
        assertThat(GroqChatClient.parseRetryAfterSeconds("")).isNull();
        assertThat(GroqChatClient.parseRetryAfterSeconds((String) null)).isNull();
    }

    // ── Câu chữ lộ ra client (§8.1: không vendor, không tiếng Anh kỹ thuật) ──

    @Test
    @DisplayName("thông điệp lỗi không lộ tên nhà cung cấp — 'Groq AI service is temporarily unavailable.' đã bị xoá")
    void errorMessagesNeverLeakVendorName() {
        respondWith(503, "{\"error\":{\"message\":\"Groq internal failure\"}}");
        GroqChatClient client = client();

        AtomicReference<String> message = new AtomicReference<>();
        assertThatThrownBy(() -> client.chatCompletion(messages(), null, 0.7, 100))
                .isInstanceOfSatisfying(AiServiceException.class, ex -> message.set(ex.getMessage()));

        assertThat(message.get())
                .doesNotContain("Groq").doesNotContain("groq")
                .doesNotContain("Whisper").doesNotContain("XTTS")
                .doesNotContain("unavailable").doesNotContain("temporarily");
    }

    @Test
    @DisplayName("4xx: thông điệp cũng trung tính, chi tiết upstream chỉ nằm trong log")
    void plain4xxMessageIsAlsoNeutral() {
        respondWith(400, "{\"error\":{\"message\":\"Groq says: 'messages' must contain the word 'json'\"}}");

        assertThatThrownBy(() -> client().chatCompletion(messages(), null, 0.7, 100))
                .isInstanceOfSatisfying(AiServiceException.class,
                        ex -> assertThat(ex.getMessage()).doesNotContain("Groq").doesNotContain("json"));
    }

    // ── Quy ước ngầm của JSON-mode (tiền lệ bug #94) ─────────────────────────

    @Test
    @DisplayName("bật response_format=json_object thì prompt PHẢI chứa chữ 'json' — nếu không Groq trả 400")
    void jsonModeRequestAlwaysCarriesTheWordJson() {
        respondWith(200, "{\"choices\":[{\"message\":{\"content\":\"{\\\"ai_speech_de\\\":\\\"Hallo\\\"}\"}}],"
                + "\"usage\":{\"prompt_tokens\":1,\"completion_tokens\":1,\"total_tokens\":2}}");

        client().chatCompletion(messages(), null, 0.7, 100);

        assertThat(receivedBodies).hasSize(1);
        String body = receivedBodies.get(0).toLowerCase();
        assertThat(body).contains("\"response_format\"");
        // Groq từ chối json-mode khi prompt không nhắc chữ "json" (bug #94) — quy ước này chưa từng
        // được guard bằng test, chỉ tồn tại như thoả thuận miệng trong prompt builder.
        assertThat(body).contains("json");
    }

    // ── reasoning_effort: chặn model reasoning đốt cạn budget completion trước khi đóng JSON ──

    private static final String OK_JSON_RESPONSE =
            "{\"choices\":[{\"message\":{\"content\":\"{\\\"ai_speech_de\\\":\\\"Hallo\\\"}\"}}],"
                    + "\"usage\":{\"prompt_tokens\":1,\"completion_tokens\":1,\"total_tokens\":2}}";

    @Test
    @DisplayName("model NÓI real-time: request PHẢI kèm reasoning_effort=low để không cạn budget → 503")
    void realtimeModelCarriesReasoningEffort() {
        respondWith(200, OK_JSON_RESPONSE);

        // model=null ⇒ effectiveModel = defaultModel (model nói real-time).
        clientWithEffort("low").chatCompletion(messages(), null, 0.7, 2000);

        assertThat(receivedBodies).hasSize(1);
        assertThat(receivedBodies.get(0)).contains("\"reasoning_effort\":\"low\"");
    }

    @Test
    @DisplayName("model CHẤM bài (truyền tường minh, khác defaultModel): KHÔNG kèm reasoning_effort")
    void gradingModelOmitsReasoningEffort() {
        respondWith(200, OK_JSON_RESPONSE);

        // gpt-oss-120b được truyền tường minh — grading giữ nguyên hành vi, không bị ép low.
        clientWithEffort("low").chatCompletion(messages(), "openai/gpt-oss-120b", 0.2, 2000);

        assertThat(receivedBodies).hasSize(1);
        assertThat(receivedBodies.get(0)).doesNotContain("reasoning_effort");
    }

    @Test
    @DisplayName("reasoning-effort rỗng: KHÔNG gửi tham số (van thoát tắt qua env)")
    void blankReasoningEffortOmitsParam() {
        respondWith(200, OK_JSON_RESPONSE);

        clientWithEffort("").chatCompletion(messages(), null, 0.7, 2000);

        assertThat(receivedBodies).hasSize(1);
        assertThat(receivedBodies.get(0)).doesNotContain("reasoning_effort");
    }

    // ── Circuit breaker (R-B1: breaker phải cắt sớm thay vì để mỗi request đốt 20s) ──

    @Test
    @DisplayName("breaker OPEN: fail-fast AI_BUSY + Retry-After 30s, KHÔNG gọi upstream nữa")
    void breakerOpenShortCircuitsWithRetryAfter() {
        // 400 (không retry) để mở breaker tức thì: test đo hành vi BREAKER, không đo backoff — dùng
        // 5xx ở đây sẽ cộng thêm 12s chờ backoff mà không chốt thêm hợp đồng nào.
        respondWith(400, "{\"error\":{\"message\":\"down\"}}");
        // ngưỡng nhỏ để mở breaker sau đúng 2 lượt hỏng, thay vì 4 mẫu như cấu hình production
        CircuitBreakers breakers = breakersOpeningAfter(2);
        GroqChatClient client = client(breakers);

        for (int i = 0; i < 2; i++) {
            assertThatThrownBy(() -> client.chatCompletion(messages(), null, 0.7, 100))
                    .isInstanceOf(AiServiceException.class);
        }
        int callsBeforeOpen = requestCount.get();

        assertThatThrownBy(() -> client.chatCompletion(messages(), null, 0.7, 100))
                .isInstanceOfSatisfying(AiServiceException.class, ex -> {
                    assertThat(ex.getCode()).isEqualTo(AiErrorCode.AI_BUSY);
                    assertThat(ex.getRetryAfterSeconds()).isEqualTo(30);
                });

        // upstream không nhận thêm request nào: đó chính là điểm của breaker
        assertThat(requestCount.get()).isEqualTo(callsBeforeOpen);
    }

    @Test
    @DisplayName("429 liên tiếp KHÔNG mở breaker — chạm trần hạn mức không được biến thành 503 toàn phần")
    void repeatedRateLimitsDoNotTripTheBreaker() {
        // Sự cố 04/08 (free tier 8000 TPM): vài user nói cùng lúc → chuỗi 429 → breaker cũ đếm là
        // failure và OPEN → MỌI user (kể cả greeting phiên mới) ăn 503 "AI đang quá tải" 30s. Bản
        // chất 429 là bucket cạn tạm thời (refill ~50s) chứ không phải Groq chết, nên breaker phải
        // đứng yên và từng request nhận đúng RATE_LIMITED + Retry-After để client tự chờ.
        // Retry-After 45s > trần 20s/lượt ⇒ mỗi lượt gọi đúng 1 request, không tốn thời gian backoff.
        respondWithSequence(rateLimited("45"));
        CircuitBreakers breakers = breakersOpeningAfter(2); // ngưỡng mở thấp — hành vi cũ mở từ lượt 3
        GroqChatClient client = client(breakers);

        for (int i = 0; i < 4; i++) {
            assertThatThrownBy(() -> client.chatCompletion(messages(), null, 0.7, 100))
                    .isInstanceOfSatisfying(AiServiceException.class, ex ->
                            // AI_BUSY ở đây nghĩa là breaker OPEN (hành vi cũ) — sai bản chất lỗi.
                            assertThat(ex.getCode()).isEqualTo(AiErrorCode.RATE_LIMITED));
        }

        // Cả 4 lượt đều thật sự tới upstream — breaker chưa từng cắt mạch.
        assertThat(requestCount.get()).isEqualTo(4);
    }

    @Test
    @DisplayName("429 xen giữa lỗi thật không che breaker: 2 lỗi 4xx vẫn đủ mở mạch")
    void rateLimitsDoNotMaskGenuineFailuresFromTheBreaker() {
        // 400-thường (lỗi thật, không retry) + 429 (bị bỏ qua) + 400 — nếu 429 bị đếm NHẦM là
        // "success" thì tỉ lệ failure tụt xuống dưới ngưỡng 50% và breaker không bao giờ mở.
        respondWithSequence(
                new StubResponse(400, "{\"error\":{\"message\":\"down\"}}"),
                rateLimited("45"),
                new StubResponse(400, "{\"error\":{\"message\":\"down\"}}"));
        CircuitBreakers breakers = breakersOpeningAfter(2);
        GroqChatClient client = client(breakers);

        for (int i = 0; i < 3; i++) {
            assertThatThrownBy(() -> client.chatCompletion(messages(), null, 0.7, 100))
                    .isInstanceOf(AiServiceException.class);
        }
        int callsBeforeOpen = requestCount.get();

        // 2 lỗi 400 đã vào cửa sổ đếm (429 không tính) ⇒ breaker OPEN, fail-fast không gọi upstream.
        assertThatThrownBy(() -> client.chatCompletion(messages(), null, 0.7, 100))
                .isInstanceOfSatisfying(AiServiceException.class, ex ->
                        assertThat(ex.getCode()).isEqualTo(AiErrorCode.AI_BUSY));
        assertThat(requestCount.get()).isEqualTo(callsBeforeOpen);
    }

    // ── Nghẽn cục bộ: semaphore hết permit → AI_BUSY + Retry-After 15s ───────

    @Test
    @DisplayName("hết permit semaphore: AI_BUSY + Retry-After 15s, không đụng tới upstream")
    void semaphoreExhaustedFailsFastWithoutCallingUpstream() throws Exception {
        respondWith(200, "{\"choices\":[{\"message\":{\"content\":\"{}\"}}]}");
        GroqConcurrencyLimiter fullLimiter = new GroqConcurrencyLimiter(limiterProps(1, 1));
        // chiếm nốt permit duy nhất để lượt gọi dưới đây chắc chắn đụng trần chờ
        assertThat(fullLimiter.tryAcquireChat()).isTrue();

        assertThatThrownBy(() -> client(fullLimiter).chatCompletion(messages(), null, 0.7, 100))
                .isInstanceOfSatisfying(AiServiceException.class, ex -> {
                    assertThat(ex.getCode()).isEqualTo(AiErrorCode.AI_BUSY);
                    assertThat(ex.getRetryAfterSeconds()).isEqualTo(15);
                });

        assertThat(requestCount.get()).isZero();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void respondWith(int status, String body) {
        respondWithSequence(new StubResponse(status, body));
    }

    /** Mỗi request nhận response kế tiếp trong dãy; hết dãy thì lặp lại response cuối. */
    private void respondWithSequence(StubResponse... responses) {
        server.createContext("/chat", exchange -> {
            int index = Math.min(requestCount.getAndIncrement(), responses.length - 1);
            StubResponse response = responses[index];
            receivedBodies.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] payload = response.body().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            response.headers().forEach((name, value) -> exchange.getResponseHeaders().add(name, value));
            exchange.sendResponseHeaders(response.status(), payload.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(payload);
            }
        });
        server.start();
    }

    private record StubResponse(int status, String body, java.util.Map<String, String> headers) {
        StubResponse(int status, String body) {
            this(status, body, java.util.Map.of());
        }
    }

    /** 429 kèm đúng bộ header hạn mức Groq trả trên prod (đo 04/08). */
    private static StubResponse rateLimited(String retryAfterSeconds) {
        return new StubResponse(429,
                "{\"error\":{\"message\":\"Rate limit reached for model `openai/gpt-oss-20b`\","
                        + "\"type\":\"tokens\",\"code\":\"rate_limit_exceeded\"}}",
                java.util.Map.of(
                        "Retry-After", retryAfterSeconds,
                        "x-ratelimit-limit-tokens", "8000",
                        "x-ratelimit-remaining-tokens", "0",
                        "x-ratelimit-reset-tokens", "49.5s"));
    }

    private GroqChatClient client() {
        return client(breakersOpeningAfter(100));
    }

    private GroqChatClient client(CircuitBreakers breakers) {
        return new GroqChatClient("test-key", "openai/gpt-oss-20b", objectMapper,
                new GroqConcurrencyLimiter(limiterProps(5, 10)), breakers, "low", baseUrl);
    }

    private GroqChatClient client(GroqConcurrencyLimiter limiter) {
        return new GroqChatClient("test-key", "openai/gpt-oss-20b", objectMapper,
                limiter, breakersOpeningAfter(100), "low", baseUrl);
    }

    /** Client với defaultModel + reasoning effort tùy chọn (rỗng = không gửi tham số). */
    private GroqChatClient clientWithEffort(String effort) {
        return new GroqChatClient("test-key", "openai/gpt-oss-20b", objectMapper,
                new GroqConcurrencyLimiter(limiterProps(5, 10)), breakersOpeningAfter(100), effort, baseUrl);
    }

    private static com.deutschflow.speaking.config.GroqProperties limiterProps(int chatPermits, int acquireSeconds) {
        var props = new com.deutschflow.speaking.config.GroqProperties();
        props.setMaxConcurrentChatRequests(chatPermits);
        props.setSemaphoreAcquireTimeoutSeconds(acquireSeconds);
        return props;
    }

    private CircuitBreakers breakersOpeningAfter(int minimumCalls) {
        return new CircuitBreakers(CircuitBreakerRegistry.of(CircuitBreakerConfig.custom()
                .slidingWindowType(CircuitBreakerConfig.SlidingWindowType.COUNT_BASED)
                .slidingWindowSize(Math.max(minimumCalls, 2))
                .minimumNumberOfCalls(minimumCalls)
                .failureRateThreshold(50f)
                .waitDurationInOpenState(Duration.ofSeconds(30))
                .build()));
    }

    private List<ChatMessage> messages() {
        return List.of(
                new ChatMessage("system", "Antworte als JSON-Objekt."),
                new ChatMessage("user", "Hallo"));
    }
}
