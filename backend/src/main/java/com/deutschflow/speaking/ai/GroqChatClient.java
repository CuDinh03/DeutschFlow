package com.deutschflow.speaking.ai;

import com.deutschflow.speaking.exception.AiErrorCode;
import com.deutschflow.speaking.exception.AiServiceException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.reactive.function.client.WebClient;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

/**
 * Calls the Groq API using its OpenAI-compatible Chat Completions endpoint.
 * Supports both blocking and SSE-streaming modes.
 *
 * <p>Endpoint: POST https://api.groq.com/openai/v1/chat/completions
 * <p>Default model: {@code openai/gpt-oss-20b}
 *
 * <p><b>Model bị khai tử</b> — Groq tắt model theo lịch (https://console.groq.com/docs/deprecations)
 * rồi trả 4xx cho model đó: {@code 400 model_decommissioned} theo tài liệu, nhưng thực tế quan sát
 * được trên production là {@code 404 model_not_found}. Cả hai đều là 4xx nên KHÔNG retry được:
 * chúng bay thẳng thành {@link AiServiceException} ⇒ 503 cho client. Ngày 17/07/2026 model cũ
 * {@code meta-llama/llama-4-scout-17b-16e-instruct} bị tắt và làm sập toàn bộ luồng Speaking.
 * {@link #isModelUnavailable} nhận diện cả hai mã để {@link #chatCompletionWithRetry} log riêng,
 * cho lần sau chẩn đoán ra ngay.
 */
@Component
@Slf4j
public class GroqChatClient implements OpenAiChatClient {

    static final String GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions";

    // ── Ngân sách thời gian một lượt gọi blocking (audit speaking 24/07, R-B1) ──
    // Trước đây: 5 attempt × (10s connect + 60s read) + backoff 62s ≈ 502s worst-case, trong khi
    // mobile chỉ chờ 15–45s và web 8–40s → client LUÔN timeout trước, còn 5 permit semaphore bị
    // ghim hàng phút làm mọi request sau 503 dây chuyền (đúng sự cố đêm 23/07). Nguyên tắc mới:
    // server phải bỏ cuộc TRƯỚC client. Trần cứng REQUEST_DEADLINE_MILLIS chặn tổng
    // (attempt + backoff); một attempt treo tối đa connect 5s + read 15s = 20s.
    private static final int MAX_ATTEMPTS = 3;
    private static final long[] BACKOFF_MILLIS = {2_000L, 4_000L};
    private static final long REQUEST_DEADLINE_MILLIS = 20_000L;
    /** Gợi ý Retry-After khi nghẽn cục bộ (semaphore) — permit thường mở sau vài giây. */
    private static final int BUSY_RETRY_AFTER_SECONDS = 15;
    /** Gợi ý Retry-After khi breaker OPEN — khớp wait-duration-in-open-state 30s trong yml. */
    private static final int BREAKER_OPEN_RETRY_AFTER_SECONDS = 30;
    /** Stream: khoảng lặng tối đa giữa 2 token trước khi coi là treo (thay cho 120s cũ). */
    private static final Duration STREAM_TOKEN_GAP_TIMEOUT = Duration.ofSeconds(30);
    /** Stream: trần tổng cho cả lượt sinh — dưới SSE emitter timeout 180s và stall-guard FE 90s. */
    private static final long STREAM_TOTAL_AWAIT_SECONDS = 90;

    private final RestClient restClient;
    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final GroqConcurrencyLimiter concurrencyLimiter;
    private final com.deutschflow.common.resilience.CircuitBreakers circuitBreakers;
    private final String apiKey;
    private final String defaultModel;

    @org.springframework.beans.factory.annotation.Autowired
    public GroqChatClient(
            @Value("${app.ai.groq.api-key:}") String apiKey,
            @Value("${app.ai.groq.model:openai/gpt-oss-20b}") String model,
            ObjectMapper objectMapper,
            GroqConcurrencyLimiter concurrencyLimiter,
            com.deutschflow.common.resilience.CircuitBreakers circuitBreakers) {
        this(apiKey, model, objectMapper, concurrencyLimiter, circuitBreakers, GROQ_BASE_URL);
    }

    /**
     * Endpoint-overridable constructor. Production always uses {@link #GROQ_BASE_URL}; tests point it
     * at a local stub server so the retry/deadline/timeout budget of R-B1 can be exercised for real
     * instead of being asserted by reading the source.
     */
    GroqChatClient(
            String apiKey,
            String model,
            ObjectMapper objectMapper,
            GroqConcurrencyLimiter concurrencyLimiter,
            com.deutschflow.common.resilience.CircuitBreakers circuitBreakers,
            String baseUrl) {
        this.apiKey = apiKey;
        this.defaultModel = model;
        this.objectMapper = objectMapper;
        this.concurrencyLimiter = concurrencyLimiter;
        this.circuitBreakers = circuitBreakers;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(15_000);

        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(factory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();

        this.webClient = WebClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();

        log.info("GroqChatClient initialized — model: {}", model);
    }

    // -----------------------------------------------------------------------
    // Blocking chat completion
    // -----------------------------------------------------------------------

    @Override
    public AiChatCompletionResult chatCompletion(List<ChatMessage> messages, String model, double temperature, Integer maxTokens) {
        String effectiveModel = (model == null || model.isBlank()) ? defaultModel : model.trim();
        String requestBody = buildRequestBody(messages, effectiveModel, temperature, maxTokens, false);
        log.debug("Calling Groq API (blocking): model={}", defaultModel);

        boolean acquired = false;
        try {
            acquired = concurrencyLimiter.tryAcquireChat();
            if (!acquired) {
                log.warn("[Groq] Semaphore timeout — too many concurrent AI requests");
                throw new AiServiceException(AiErrorCode.AI_BUSY,
                        "Trợ lý AI đang bận, vui lòng thử lại sau ít giây.", BUSY_RETRY_AFTER_SECONDS);
            }
            // Circuit-breaker guarded (semaphore stays OUTSIDE so local backpressure isn't counted
            // as an upstream failure). When Groq is down the breaker trips and we skip the retry loop.
            return circuitBreakers.call(
                    "groqChat",
                    () -> chatCompletionWithRetry(requestBody, effectiveModel),
                    () -> new AiServiceException(AiErrorCode.AI_BUSY,
                            "AI đang quá tải, thử lại sau ít phút.", BREAKER_OPEN_RETRY_AFTER_SECONDS));
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new AiServiceException(AiErrorCode.AI_INTERRUPTED,
                    "Yêu cầu AI bị gián đoạn, vui lòng thử lại.", null, ie);
        } finally {
            if (acquired) {
                concurrencyLimiter.releaseChat();
            }
        }
    }

    private AiChatCompletionResult chatCompletionWithRetry(String requestBody, String effectiveModel) {
        long deadlineNanos = System.nanoTime() + REQUEST_DEADLINE_MILLIS * 1_000_000L;
        Exception lastException = null;
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                String responseBody = restClient.post()
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                        .body(requestBody)
                        .retrieve()
                        .body(String.class);
                return extractResult(responseBody, effectiveModel);
            } catch (RestClientResponseException e) {
                int statusCode = e.getStatusCode().value();
                if (statusCode != 429 && statusCode < 500) {
                    String body = e.getResponseBodyAsString();
                    // json_validate_failed là kết quả SINH (model nhả JSON hỏng/cụt trong json-mode),
                    // không phải request sai — gọi lại với temperature > 0 thường ra bản hợp lệ.
                    // Groq gói nó trong 400 nên phải tách riêng khỏi nhóm 4xx chết-hẳn (đo prod
                    // 29/07: greeting gpt-oss-20b dính "max completion tokens reached").
                    if (isJsonValidateFailed(body)) {
                        log.warn("[Groq] json_validate_failed on attempt {}/{} — retrying generation. Body: {}",
                                attempt, MAX_ATTEMPTS, body);
                        lastException = e;
                    } else {
                        if (isModelUnavailable(body)) {
                            // Sự cố vận hành, KHÔNG phải lỗi tạm thời: retry bao nhiêu lần cũng vô ích và
                            // mọi người dùng đều gãy cùng lúc. Log ERROR nêu đích danh việc cần làm.
                            log.error("[Groq] MODEL KHÔNG DÙNG ĐƯỢC: '{}' đã bị khai tử, hoặc tài khoản "
                                            + "không có quyền truy cập. Đổi env GROQ_MODEL/GROQ_GRADING_MODEL "
                                            + "sang model còn sống (https://console.groq.com/docs/deprecations), "
                                            + "đối chiếu GET /openai/v1/models, rồi restart. Body: {}",
                                    effectiveModel, body);
                        } else {
                            log.error("[Groq] API error {}: {}", statusCode, body);
                        }
                        // Thông điệp lộ ra client (thành `detail` của ProblemDetail 503) nên giữ trung tính:
                        // không nêu tên nhà cung cấp, không nêu mã lỗi upstream. Chi tiết nằm ở log trên.
                        throw new AiServiceException("Dịch vụ AI tạm thời không khả dụng, vui lòng thử lại sau.", e);
                    }
                } else {
                    log.warn("[Groq] {} on attempt {}/{}", statusCode, attempt, MAX_ATTEMPTS);
                    lastException = e;
                }
            } catch (ResourceAccessException e) {
                log.warn("[Groq] timeout on attempt {}/{}: {}", attempt, MAX_ATTEMPTS, e.getMessage());
                lastException = e;
            }
            if (attempt < MAX_ATTEMPTS && !backoffWithinDeadline(attempt, deadlineNanos)) {
                log.warn("[Groq] bỏ retry sau attempt {}/{}: chạm trần {}ms cho một lượt gọi",
                        attempt, MAX_ATTEMPTS, REQUEST_DEADLINE_MILLIS);
                break;
            }
        }
        throw new AiServiceException("Trợ lý AI đang bận, vui lòng thử lại sau ít phút.", lastException);
    }

    // -----------------------------------------------------------------------
    // Streaming chat completion (SSE)
    // -----------------------------------------------------------------------

    @Override
    public boolean chatCompletionStream(List<ChatMessage> messages, String model, double temperature,
                                        Integer maxTokens, Consumer<String> onToken,
                                        Consumer<AiChatCompletionResult> onComplete,
                                        AtomicBoolean cancelled) {
        String effectiveModel = (model == null || model.isBlank()) ? defaultModel : model.trim();
        String requestBody = buildRequestBody(messages, effectiveModel, temperature, maxTokens, true);
        log.debug("Calling Groq API (stream): model={}", defaultModel);

        boolean acquired = false;
        try {
            acquired = concurrencyLimiter.tryAcquireChat();
            if (!acquired) {
                log.warn("[Groq] Semaphore timeout (stream) — too many concurrent AI requests");
                throw new AiServiceException(AiErrorCode.AI_BUSY,
                        "Trợ lý AI đang bận, vui lòng thử lại sau ít giây.", BUSY_RETRY_AFTER_SECONDS);
            }
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new AiServiceException(AiErrorCode.AI_INTERRUPTED,
                    "Yêu cầu AI bị gián đoạn, vui lòng thử lại.", null, ie);
        }

        try {
            // Audit 24/07, R-B2: nhánh stream đi qua CÙNG breaker "groqChat" với nhánh blocking.
            // Trước đây stream gọi thẳng WebClient nên khi Groq chết, các stream fail liên tiếp
            // KHÔNG được đếm — breaker không bao giờ mở từ web /v2, mỗi user treo đủ 120s.
            // Cancel (barge-in/leave) trả false = success với breaker, đúng vì không phải lỗi upstream.
            return circuitBreakers.call(
                    "groqChat",
                    () -> pumpStream(requestBody, effectiveModel, messages, onToken, onComplete, cancelled),
                    () -> new AiServiceException(AiErrorCode.AI_BUSY,
                            "AI đang quá tải, thử lại sau ít phút.", BREAKER_OPEN_RETRY_AFTER_SECONDS));
        } finally {
            if (acquired) {
                concurrencyLimiter.releaseChat();
            }
        }
    }

    /** Thân stream tách riêng để bọc breaker; mọi lỗi upstream nổi lên dạng {@link AiServiceException}. */
    private boolean pumpStream(String requestBody, String effectiveModel, List<ChatMessage> messages,
                               Consumer<String> onToken, Consumer<AiChatCompletionResult> onComplete,
                               AtomicBoolean cancelled) {
        try {
            StringBuilder full = new StringBuilder();
            CountDownLatch done = new CountDownLatch(1);
            final Throwable[] errorRef = new Throwable[1];

            webClient.post()
                    .uri(GROQ_BASE_URL)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .header(HttpHeaders.ACCEPT, "text/event-stream")
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToFlux(new ParameterizedTypeReference<ServerSentEvent<String>>() {})
                    .takeWhile(evt -> cancelled == null || !cancelled.get())
                    .timeout(STREAM_TOKEN_GAP_TIMEOUT)
                    .subscribe(
                            evt -> handleServerSentEvent(evt, full, onToken),
                            err -> {
                                errorRef[0] = err;
                                done.countDown();
                            },
                            done::countDown
                    );

            boolean completed = done.await(STREAM_TOTAL_AWAIT_SECONDS, TimeUnit.SECONDS);
            if (!completed) {
                log.warn("[Groq-stream] không hoàn tất trong {}s — coi là treo", STREAM_TOTAL_AWAIT_SECONDS);
                throw new AiServiceException(AiErrorCode.AI_TIMEOUT,
                        "Trợ lý AI phản hồi quá chậm, vui lòng thử lại.", null);
            }
            if (cancelled != null && cancelled.get()) {
                return false;
            }
            if (errorRef[0] != null) {
                log.warn("[Groq-stream] upstream error: {}", errorRef[0].getMessage());
                throw new AiServiceException(AiErrorCode.AI_UPSTREAM_UNAVAILABLE,
                        "Dịch vụ AI tạm thời gián đoạn, vui lòng thử lại.", null, errorRef[0]);
            }
            if (full.length() == 0) {
                throw new AiServiceException("Dịch vụ AI trả về phản hồi rỗng, vui lòng thử lại.");
            }

            TokenUsage usage = estimateUsage(messages, full.toString());
            onComplete.accept(new AiChatCompletionResult(full.toString(), usage, "GROQ", effectiveModel));
            return true;
        } catch (AiServiceException e) {
            throw e;
        } catch (Exception e) {
            if (cancelled != null && cancelled.get()) {
                log.debug("[Groq-stream] cancelled during WebClient pump");
                return false;
            }
            log.warn("[Groq-stream] pump failed: {}", e.getMessage());
            throw new AiServiceException(AiErrorCode.AI_UPSTREAM_UNAVAILABLE,
                    "Dịch vụ AI tạm thời gián đoạn, vui lòng thử lại.", null, e);
        }
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private String buildRequestBody(List<ChatMessage> messages, String model,
                                    double temperature, Integer maxTokens, boolean stream) {
        try {
            ObjectNode root = objectMapper.createObjectNode();
            root.put("model", model);
            root.put("temperature", temperature);
            if (maxTokens != null && maxTokens > 0) {
                root.put("max_tokens", maxTokens);
            } else {
                root.put("max_tokens", 600);
            }
            // Force JSON output in both blocking and streaming modes
            ObjectNode responseFormat = root.putObject("response_format");
            responseFormat.put("type", "json_object");
            if (stream) {
                root.put("stream", true);
            }

            ArrayNode messagesArray = root.putArray("messages");
            for (ChatMessage msg : messages) {
                ObjectNode msgNode = messagesArray.addObject();
                msgNode.put("role", msg.role());
                msgNode.put("content", msg.content());
            }

            return objectMapper.writeValueAsString(root);
        } catch (Exception e) {
            throw new AiServiceException("Failed to build Groq request body", e);
        }
    }

    private AiChatCompletionResult extractResult(String responseBody, String effectiveModel) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode usage = root.get("usage");
            TokenUsage parsedUsage = null;
            if (usage != null) {
                log.debug("[Groq] tokens — prompt: {}, completion: {}, total: {}",
                        usage.path("prompt_tokens").asInt(),
                        usage.path("completion_tokens").asInt(),
                        usage.path("total_tokens").asInt());
                parsedUsage = TokenUsage.exact(
                        usage.path("prompt_tokens").asInt(0),
                        usage.path("completion_tokens").asInt(0),
                        usage.path("total_tokens").asInt(0)
                );
            }
            String content = root.path("choices").get(0).path("message").path("content").asText();
            return new AiChatCompletionResult(content, parsedUsage, "GROQ", effectiveModel);
        } catch (Exception e) {
            throw new AiServiceException("Failed to parse Groq response", e);
        }
    }

    private void handleServerSentEvent(ServerSentEvent<String> evt, StringBuilder full, Consumer<String> onToken) {
        if (evt == null) {
            return;
        }
        String data = evt.data();
        if (data == null || data.isBlank()) {
            return;
        }
        String trimmed = data.trim();
        if ("[DONE]".equals(trimmed)) {
            return;
        }
        try {
            JsonNode node = objectMapper.readTree(trimmed);
            String delta = node.path("choices").path(0)
                    .path("delta").path("content").asText(null);
            if (delta != null && !delta.isEmpty()) {
                full.append(delta);
                onToken.accept(delta);
            }
        } catch (Exception parseEx) {
            log.trace("[Groq-stream] skipping unparseable chunk: {}", trimmed);
        }
    }

    private TokenUsage estimateUsage(List<ChatMessage> messages, String completionText) {
        int promptChars = 0;
        if (messages != null) {
            for (ChatMessage m : messages) {
                if (m != null && m.content() != null) promptChars += m.content().length();
            }
        }
        int completionChars = completionText == null ? 0 : completionText.length();
        // Very rough heuristic: ~4 chars/token for Latin text.
        int promptTokens = Math.max(1, (int) Math.ceil(promptChars / 4.0));
        int completionTokens = Math.max(1, (int) Math.ceil(completionChars / 4.0));
        return TokenUsage.estimated(promptTokens, completionTokens, promptTokens + completionTokens);
    }

    /**
     * Model không dùng được nữa — không phải sự cố tạm thời.
     *
     * <p>Groq dùng HAI mã cho cùng một tình trạng, và tài liệu chỉ nêu mã đầu:
     * <ul>
     *   <li>{@code model_decommissioned} (HTTP 400) — theo tài liệu deprecations.</li>
     *   <li>{@code model_not_found} (HTTP 404) — "does not exist or you do not have access to it".
     *       ĐÂY MỚI LÀ mã thực tế quan sát được trên production ngày 21/07/2026, sau khi
     *       llama-4-scout bị gỡ khỏi danh mục. Chỉ khớp mã đầu là bỏ lọt đúng ca thật.</li>
     * </ul>
     *
     * <p>Khớp trên chuỗi thô thay vì parse JSON: thân lỗi là hợp đồng của bên thứ ba, một thay đổi
     * hình dạng nhỏ không được phép biến việc nhận diện này thành một exception khác.
     */
    static boolean isModelUnavailable(String responseBody) {
        return responseBody != null
                && (responseBody.contains("model_decommissioned") || responseBody.contains("model_not_found"));
    }

    /**
     * Groq 400 {@code json_validate_failed}: model không sinh nổi JSON hợp lệ trong json-mode
     * (thường "max completion tokens reached before generating a valid document" với model
     * reasoning, hoặc output hỏng ngẫu nhiên). Là kết quả sinh chứ không phải request sai →
     * retryable, khác hẳn nhóm 4xx chết-hẳn. Khớp chuỗi thô cùng lý do với
     * {@link #isModelUnavailable}.
     */
    static boolean isJsonValidateFailed(String responseBody) {
        return responseBody != null && responseBody.contains("json_validate_failed");
    }

    /**
     * Ngủ backoff cho attempt vừa hỏng nếu vẫn còn nằm trong trần thời gian của lượt gọi;
     * trả {@code false} khi ngân sách đã cạn (bỏ retry, fail ngay) hoặc thread bị interrupt.
     */
    private boolean backoffWithinDeadline(int attempt, long deadlineNanos) {
        long delay = BACKOFF_MILLIS[Math.min(attempt - 1, BACKOFF_MILLIS.length - 1)];
        long remainingMillis = (deadlineNanos - System.nanoTime()) / 1_000_000L;
        if (remainingMillis <= delay) {
            return false;
        }
        try {
            Thread.sleep(delay);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            return false;
        }
        return true;
    }
}
