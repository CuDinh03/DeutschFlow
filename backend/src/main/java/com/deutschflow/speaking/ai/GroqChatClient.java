package com.deutschflow.speaking.ai;

import com.deutschflow.ai.tier.TierSpec;
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
import org.springframework.web.reactive.function.client.WebClientResponseException;

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
    /**
     * Gợi ý Retry-After khi upstream trả 429 mà KHÔNG kèm header. Groq tính hạn mức theo cửa sổ
     * token/phút và bucket đầy lại trong khoảng một phút (đo prod 04/08: reset_tokens ~50s), nên
     * 60s là mốc an toàn để client không đập lại vào đúng cửa sổ vẫn đang cạn.
     */
    private static final int DEFAULT_RATE_LIMIT_RETRY_AFTER_SECONDS = 60;
    /** Header hạn mức của Groq, gom vào log 429 để chẩn đoán "burst" hay "chạm trần tier". */
    private static final String[] RATE_LIMIT_HEADERS = {
            "x-ratelimit-limit-tokens", "x-ratelimit-remaining-tokens", "x-ratelimit-reset-tokens",
            "x-ratelimit-limit-requests", "x-ratelimit-remaining-requests"
    };
    /** Stream: khoảng lặng tối đa giữa 2 token trước khi coi là treo (thay cho 120s cũ). */
    private static final Duration STREAM_TOKEN_GAP_TIMEOUT = Duration.ofSeconds(30);
    /** Stream: trần tổng cho cả lượt sinh — dưới SSE emitter timeout 180s và stall-guard FE 90s. */
    private static final long STREAM_TOTAL_AWAIT_SECONDS = 90;

    /**
     * 429 hạn mức KHÔNG phải "upstream chết": Groq vẫn sống, bucket token refill trong ~1 phút.
     * Nếu để breaker đếm 429 là failure thì vài user chạm trần TPM là breaker mở → MỌI user 503
     * trong 30s (kể cả greeting phiên mới) — biến quá tải cục bộ thành sập toàn phần (đo prod 04/08,
     * free tier 8000 TPM). Lỗi vẫn ném ra cho client nhận 429 + Retry-After như PR #288.
     */
    private static final java.util.function.Predicate<Throwable> RATE_LIMIT_IS_NOT_DOWNTIME =
            t -> t instanceof AiServiceException ase && ase.getCode() == AiErrorCode.RATE_LIMITED;

    private final RestClient restClient;
    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final GroqConcurrencyLimiter concurrencyLimiter;
    private final com.deutschflow.common.resilience.CircuitBreakers circuitBreakers;
    private final String apiKey;
    private final String defaultModel;
    /**
     * Reasoning effort ("low"/"medium"/"high") gửi kèm CHỈ cho model NÓI real-time
     * ({@link #defaultModel}). Rỗng ⇒ không gửi (giữ hành vi cũ). Xem {@link #buildRequestBody}.
     */
    private final String reasoningEffort;
    /** Endpoint chat-completions thực dùng — mặc định {@link #GROQ_BASE_URL}, đè được qua env/test. */
    private final String baseUrl;
    /**
     * Client theo endpoint cho các TIER override base-url (flip OpenRouter từng tầng — khung
     * plans/2026-08-07). Lazy, tối đa vài entry; key = base-url của tier.
     */
    private final java.util.concurrent.ConcurrentHashMap<String, RestClient> restClientsByBaseUrl =
            new java.util.concurrent.ConcurrentHashMap<>();
    private final java.util.concurrent.ConcurrentHashMap<String, WebClient> webClientsByBaseUrl =
            new java.util.concurrent.ConcurrentHashMap<>();

    /**
     * Constructor duy nhất, endpoint-overridable. Production mặc định {@link #GROQ_BASE_URL} nhưng
     * đè được qua env {@code GROQ_BASE_URL} (bảo hiểm vendor: trỏ sang một endpoint OpenAI-compatible
     * khác không cần sửa code — bài học llama-4-scout khai tử 17/07 + trần free tier 04/08); tests
     * point it at a local stub server so the retry/deadline/timeout budget of R-B1 can be exercised
     * for real instead of being asserted by reading the source.
     */
    GroqChatClient(
            @Value("${app.ai.groq.api-key:}") String apiKey,
            @Value("${app.ai.groq.model:openai/gpt-oss-20b}") String model,
            ObjectMapper objectMapper,
            GroqConcurrencyLimiter concurrencyLimiter,
            com.deutschflow.common.resilience.CircuitBreakers circuitBreakers,
            @Value("${app.ai.groq.reasoning-effort:low}") String reasoningEffort,
            @Value("${app.ai.groq.base-url:" + GROQ_BASE_URL + "}") String baseUrl) {
        this.apiKey = apiKey;
        this.defaultModel = model;
        this.objectMapper = objectMapper;
        this.concurrencyLimiter = concurrencyLimiter;
        this.circuitBreakers = circuitBreakers;
        this.reasoningEffort = reasoningEffort == null ? "" : reasoningEffort.trim();
        this.baseUrl = baseUrl;

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

        log.info("GroqChatClient initialized — model: {}, reasoning_effort: {}",
                model, this.reasoningEffort.isBlank() ? "(unset)" : this.reasoningEffort);
    }

    // -----------------------------------------------------------------------
    // Blocking chat completion
    // -----------------------------------------------------------------------

    @Override
    public AiChatCompletionResult chatCompletion(List<ChatMessage> messages, String model, double temperature, Integer maxTokens) {
        String effectiveModel = (model == null || model.isBlank()) ? defaultModel : model.trim();
        String requestBody = buildRequestBody(messages, effectiveModel, temperature, maxTokens, false, null);
        log.debug("Calling Groq API (blocking): model={}", defaultModel);
        return completeBlocking(restClient, apiKey, requestBody, effectiveModel);
    }

    /**
     * Đường gọi theo TẦNG (khung plans/2026-08-07): model/endpoint/key/effort/provider lấy trọn từ
     * {@link TierSpec}. Đi CÙNG semaphore + breaker {@code groqChat} với đường cũ — backpressure và
     * cách ly sự cố thuộc về hạ tầng client, không thuộc về tầng.
     */
    @Override
    public AiChatCompletionResult chatCompletionForTier(List<ChatMessage> messages, TierSpec tier,
                                                 double temperature, Integer maxTokens) {
        if (tier == null) {
            return chatCompletion(messages, (String) null, temperature, maxTokens);
        }
        String requestBody = buildRequestBody(messages, tier.model(), temperature, maxTokens, false, tier);
        log.debug("Calling LLM (blocking, tier {}): model={}", tier.tier(), tier.model());
        return completeBlocking(restClientFor(tier.baseUrl()), keyFor(tier), requestBody, tier.model());
    }

    /** Thân blocking dùng chung cho cả hai overload: semaphore → breaker → retry. */
    private AiChatCompletionResult completeBlocking(RestClient client, String authKey,
                                                    String requestBody, String effectiveModel) {
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
                    () -> chatCompletionWithRetry(client, authKey, requestBody, effectiveModel),
                    () -> new AiServiceException(AiErrorCode.AI_BUSY,
                            "AI đang quá tải, thử lại sau ít phút.", BREAKER_OPEN_RETRY_AFTER_SECONDS),
                    RATE_LIMIT_IS_NOT_DOWNTIME);
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

    private AiChatCompletionResult chatCompletionWithRetry(RestClient client, String authKey,
                                                           String requestBody, String effectiveModel) {
        long deadlineNanos = System.nanoTime() + REQUEST_DEADLINE_MILLIS * 1_000_000L;
        Exception lastException = null;
        // Lần hỏng GẦN NHẤT có phải 429 không — quyết định mã lỗi ném ra ở cuối vòng (một lượt gọi
        // có thể trộn 503 rồi 429 hoặc ngược lại). rateLimitRetryAfter là gợi ý Retry-After kèm theo
        // (giây; null khi upstream không nói ⇒ dùng mặc định), luôn được gán lại ở mỗi lần 429 nên
        // không bao giờ mang giá trị cũ.
        boolean lastFailureWasRateLimit = false;
        Integer rateLimitRetryAfter = null;
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            // Mặc định là backoff cố định; nhánh 429 ghi đè bằng chính Retry-After của upstream.
            long nextDelayMillis = BACKOFF_MILLIS[Math.min(attempt - 1, BACKOFF_MILLIS.length - 1)];
            try {
                String responseBody = client.post()
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + authKey)
                        .body(requestBody)
                        .retrieve()
                        .body(String.class);
                return extractResult(responseBody, effectiveModel);
            } catch (RestClientResponseException e) {
                int statusCode = e.getStatusCode().value();
                lastFailureWasRateLimit = false;
                if (statusCode == 429) {
                    // ── Hạn mức upstream (đo prod 04/08) ────────────────────────────────────
                    // Tài khoản Groq free tier: 8.000 token/PHÚT cho openai/gpt-oss-20b, và Groq trừ
                    // theo `max_tokens` ĐẶT CHỖ chứ không theo token thật sinh ra (1 lượt nói thật =
                    // 1234 prompt + 2000 đặt chỗ = 3234, trong khi chỉ sinh 174). Tức cả prod chỉ
                    // chạy được ~3-5 lượt/phút. Bucket refill ~50s, trong khi ngân sách một lượt gọi
                    // chỉ 20s ⇒ retry mù CHẮC CHẮN trượt mà vẫn đốt hạn mức 1000 request/ngày.
                    // Vì vậy: nghe theo Retry-After của upstream, và bỏ cuộc NGAY nếu phải chờ lâu
                    // hơn ngân sách còn lại.
                    rateLimitRetryAfter = parseRetryAfterSeconds(e);
                    lastFailureWasRateLimit = true;
                    lastException = e;
                    log.warn("[Groq] 429 HẠN MỨC UPSTREAM attempt {}/{} — retry_after={}, {}. "
                                    + "Nếu lặp lại liên tục: tài khoản Groq đang chạm trần tokens/phút "
                                    + "(free tier = 8000 TPM) — nâng tier hoặc hạ system_config ai.maxTokens.",
                            attempt, MAX_ATTEMPTS,
                            rateLimitRetryAfter == null ? "(upstream không nói)" : rateLimitRetryAfter + "s",
                            describeRateLimitHeaders(e));
                    if (rateLimitRetryAfter != null) {
                        long suggestedMillis = rateLimitRetryAfter * 1_000L;
                        if (!fitsInDeadline(suggestedMillis, deadlineNanos)) {
                            log.warn("[Groq] bỏ retry NGAY: upstream bảo chờ {}s > ngân sách còn lại "
                                    + "của lượt gọi ({}ms) — retry chỉ đốt thêm hạn mức request.",
                                    rateLimitRetryAfter, REQUEST_DEADLINE_MILLIS);
                            throw rateLimitException(rateLimitRetryAfter, e);
                        }
                        nextDelayMillis = suggestedMillis;
                    }
                } else if (statusCode < 500) {
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
                lastFailureWasRateLimit = false;
                lastException = e;
            }
            if (attempt < MAX_ATTEMPTS && !sleepWithinDeadline(nextDelayMillis, deadlineNanos)) {
                log.warn("[Groq] bỏ retry sau attempt {}/{}: chạm trần {}ms cho một lượt gọi",
                        attempt, MAX_ATTEMPTS, REQUEST_DEADLINE_MILLIS);
                break;
            }
        }
        // Hết ngân sách vì hạn mức upstream là một CHẨN ĐOÁN KHÁC hẳn "AI bận": nó không tự khỏi khi
        // tải giảm, mà đòi nâng tier / hạ cap token. Mã riêng cho client + metric
        // speaking.ai.failures{code=RATE_LIMITED} (GlobalExceptionHandler tự đếm) để lần sau nhìn ra
        // ngay thay vì phải gọi thẳng API nhà cung cấp mới biết.
        if (lastFailureWasRateLimit) {
            throw rateLimitException(rateLimitRetryAfter, lastException);
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
        String requestBody = buildRequestBody(messages, effectiveModel, temperature, maxTokens, true, null);
        log.debug("Calling Groq API (stream): model={}", defaultModel);
        return streamGuarded(webClient, baseUrl, apiKey, requestBody, effectiveModel,
                messages, onToken, onComplete, cancelled);
    }

    /** Bản stream của đường gọi theo TẦNG — cùng semaphore + breaker với nhánh cũ. */
    @Override
    public boolean chatCompletionStreamForTier(List<ChatMessage> messages, TierSpec tier, double temperature,
                                        Integer maxTokens, Consumer<String> onToken,
                                        Consumer<AiChatCompletionResult> onComplete,
                                        AtomicBoolean cancelled) {
        if (tier == null) {
            return chatCompletionStream(messages, (String) null, temperature, maxTokens,
                    onToken, onComplete, cancelled);
        }
        String requestBody = buildRequestBody(messages, tier.model(), temperature, maxTokens, true, tier);
        log.debug("Calling LLM (stream, tier {}): model={}", tier.tier(), tier.model());
        String effectiveBaseUrl = tier.baseUrl() != null ? tier.baseUrl() : baseUrl;
        return streamGuarded(webClientFor(tier.baseUrl()), effectiveBaseUrl, keyFor(tier),
                requestBody, tier.model(), messages, onToken, onComplete, cancelled);
    }

    /** Thân stream dùng chung: semaphore → breaker → pump. */
    private boolean streamGuarded(WebClient wc, String endpointUrl, String authKey,
                                  String requestBody, String effectiveModel, List<ChatMessage> messages,
                                  Consumer<String> onToken, Consumer<AiChatCompletionResult> onComplete,
                                  AtomicBoolean cancelled) {
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
                    () -> pumpStream(wc, endpointUrl, authKey, requestBody, effectiveModel,
                            messages, onToken, onComplete, cancelled),
                    () -> new AiServiceException(AiErrorCode.AI_BUSY,
                            "AI đang quá tải, thử lại sau ít phút.", BREAKER_OPEN_RETRY_AFTER_SECONDS),
                    RATE_LIMIT_IS_NOT_DOWNTIME);
        } finally {
            if (acquired) {
                concurrencyLimiter.releaseChat();
            }
        }
    }

    /** Thân stream tách riêng để bọc breaker; mọi lỗi upstream nổi lên dạng {@link AiServiceException}. */
    private boolean pumpStream(WebClient wc, String endpointUrl, String authKey,
                               String requestBody, String effectiveModel, List<ChatMessage> messages,
                               Consumer<String> onToken, Consumer<AiChatCompletionResult> onComplete,
                               AtomicBoolean cancelled) {
        try {
            StringBuilder full = new StringBuilder();
            CountDownLatch done = new CountDownLatch(1);
            final Throwable[] errorRef = new Throwable[1];

            wc.post()
                    .uri(endpointUrl)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + authKey)
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
                // Nhánh stream KHÔNG retry (đã phát token ra client rồi thì không gọi lại được), nhưng
                // vẫn phải phân biệt 429: nó là chẩn đoán hạn mức tài khoản chứ không phải "gián đoạn
                // tạm thời", và web /v2 đọc `code` trong SSE event error để chọn thông điệp. Trước đây
                // mọi lỗi stream đều đội lốt AI_UPSTREAM_UNAVAILABLE nên hạn mức là vô hình ở đường web
                // — đúng đường mà người dùng gặp hôm 04/08.
                AiServiceException rateLimited = asStreamRateLimit(errorRef[0]);
                if (rateLimited != null) {
                    throw rateLimited;
                }
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
                                    double temperature, Integer maxTokens, boolean stream,
                                    TierSpec tier) {
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
            // gpt-oss là REASONING model: token "nghĩ" tính CHUNG vào max_tokens. Ở mức mặc định model
            // nghĩ nhiều nên với lượt chat NẶNG (lịch sử + RAG context, khác greeting nhẹ) nó cạn budget
            // completion TRƯỚC khi đóng xong JSON → Groq trả 400 json_validate_failed (blocking) / lỗi
            // stream (web) → 503; 2 lần liên tiếp mở luôn breaker làm cả hội thoại mới chết theo. Bản vá
            // d1769766 chỉ nới max_tokens (512→2000) mà chưa chặn phần "nghĩ" — đây là mắt xích còn thiếu.
            // reasoning_effort=low chừa trọn budget cho JSON.
            // Đường TẦNG: effort là thuộc tính của tier (chỉ gửi khi tier khai). Đường cũ giữ nguyên
            // luật lịch sử: chỉ áp cho MODEL NÓI real-time (defaultModel); model CHẤM (truyền tường
            // minh) không bị dính effort.
            if (tier != null) {
                if (tier.reasoningEffort() != null) {
                    root.put("reasoning_effort", tier.reasoningEffort());
                }
                appendTierExtras(root, tier);
            } else if (reasoningEffort != null && !reasoningEffort.isBlank()
                    && defaultModel != null && defaultModel.equals(model)) {
                root.put("reasoning_effort", reasoningEffort.trim());
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
            Double costUsd = null;
            if (usage != null) {
                log.debug("[Groq] tokens — prompt: {}, completion: {}, total: {}",
                        usage.path("prompt_tokens").asInt(),
                        usage.path("completion_tokens").asInt(),
                        usage.path("total_tokens").asInt());
                parsedUsage = TokenUsage.exact(
                        usage.path("prompt_tokens").asInt(0),
                        usage.path("completion_tokens").asInt(0),
                        usage.path("total_tokens").asInt(0),
                        // Prompt caching của nhà cung cấp. Fireworks bật TỰ ĐỘNG và tính token cache
                        // chỉ 10–50% giá input thường; đo 09/08 thấy hit ~99% ở cả 8 tier (system
                        // prompt lặp y nguyên mỗi lượt) ⇒ không đọc field này là ước phí cao hơn
                        // thực tế nhiều lần. Endpoint nào không có `prompt_tokens_details` → 0.
                        usage.path("prompt_tokens_details").path("cached_tokens").asInt(0)
                );
                // OpenRouter trả cost THẬT (USD) khi request bật usage.include — chính xác hơn mọi
                // bảng giá ước tính trong AiCostEstimator. Groq không có field này → null.
                JsonNode cost = usage.get("cost");
                if (cost != null && cost.isNumber()) {
                    costUsd = cost.asDouble();
                }
            }
            String content = root.path("choices").get(0).path("message").path("content").asText();
            return new AiChatCompletionResult(content, parsedUsage, "GROQ", effectiveModel, costUsd);
        } catch (Exception e) {
            throw new AiServiceException("Failed to parse Groq response", e);
        }
    }

    /**
     * Các field chỉ tồn tại ở đường TẦNG — provider preferences + usage accounting của OpenRouter
     * (https://openrouter.ai/docs — provider routing). Endpoint không phải OpenRouter (Groq) bỏ qua
     * field lạ là hành vi chuẩn OpenAI-compatible, nhưng ta vẫn CHỈ serialize khi tier khai để
     * request các tầng chưa flip giữ nguyên byte-for-byte.
     */
    private void appendTierExtras(ObjectNode root, TierSpec tier) {
        if (tier.hasProviderPreferences()) {
            ObjectNode provider = root.putObject("provider");
            if (!tier.providerOrder().isEmpty()) {
                ArrayNode order = provider.putArray("order");
                tier.providerOrder().forEach(order::add);
            }
            if (tier.requireParameters() != null) {
                provider.put("require_parameters", tier.requireParameters());
            }
            if (tier.sort() != null) {
                provider.put("sort", tier.sort());
            }
            if (!tier.quantizations().isEmpty()) {
                ArrayNode quant = provider.putArray("quantizations");
                tier.quantizations().forEach(quant::add);
            }
        }
        if (tier.includeUsage()) {
            root.putObject("usage").put("include", true);
        }
    }

    /** RestClient cho endpoint của tier — null base-url = endpoint mặc định (Groq). */
    private RestClient restClientFor(String tierBaseUrl) {
        if (tierBaseUrl == null || tierBaseUrl.equals(baseUrl)) {
            return restClient;
        }
        return restClientsByBaseUrl.computeIfAbsent(tierBaseUrl, url -> {
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(5_000);
            factory.setReadTimeout(15_000);
            return RestClient.builder()
                    .baseUrl(url)
                    .requestFactory(factory)
                    .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .build();
        });
    }

    /** WebClient (stream) cho endpoint của tier — cùng quy ước với {@link #restClientFor}. */
    private WebClient webClientFor(String tierBaseUrl) {
        if (tierBaseUrl == null || tierBaseUrl.equals(baseUrl)) {
            return webClient;
        }
        return webClientsByBaseUrl.computeIfAbsent(tierBaseUrl, url -> WebClient.builder()
                .baseUrl(url)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build());
    }

    /** API key hiệu lực cho tier — tier không khai thì dùng key mặc định của client (Groq). */
    private String keyFor(TierSpec tier) {
        return tier.apiKey() != null ? tier.apiKey() : apiKey;
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
     * Nhận diện 429 ở nhánh stream (WebClient ném {@code WebClientResponseException}, KHÁC
     * {@code RestClientResponseException} của nhánh blocking). Trả {@code null} nếu không phải 429.
     */
    private AiServiceException asStreamRateLimit(Throwable error) {
        if (!(error instanceof WebClientResponseException wcre) || wcre.getStatusCode().value() != 429) {
            return null;
        }
        Integer retryAfter = parseRetryAfterSeconds(wcre.getHeaders().getFirst(HttpHeaders.RETRY_AFTER));
        log.warn("[Groq-stream] 429 HẠN MỨC UPSTREAM — retry_after={}. Nếu lặp lại liên tục: tài khoản "
                        + "Groq đang chạm trần tokens/phút (free tier = 8000 TPM) — nâng tier hoặc hạ "
                        + "system_config ai.maxTokens.",
                retryAfter == null ? "(upstream không nói)" : retryAfter + "s");
        return rateLimitException(retryAfter, wcre);
    }

    /** Còn đủ chỗ trong ngân sách của lượt gọi để chờ {@code delayMillis} rồi thử lại không? */
    private boolean fitsInDeadline(long delayMillis, long deadlineNanos) {
        long remainingMillis = (deadlineNanos - System.nanoTime()) / 1_000_000L;
        return remainingMillis > delayMillis;
    }

    /**
     * Ngủ {@code delayMillis} trước attempt kế nếu vẫn còn nằm trong trần thời gian của lượt gọi;
     * trả {@code false} khi ngân sách đã cạn (bỏ retry, fail ngay) hoặc thread bị interrupt.
     */
    private boolean sleepWithinDeadline(long delayMillis, long deadlineNanos) {
        if (!fitsInDeadline(delayMillis, deadlineNanos)) {
            return false;
        }
        try {
            Thread.sleep(delayMillis);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            return false;
        }
        return true;
    }

    /**
     * Lỗi hạn mức upstream. Message là câu tiếng Việt trung tính (nó thành {@code detail} của
     * ProblemDetail 503 / payload SSE {@code error}); {@code retryAfterSeconds} thành header
     * {@code Retry-After} để client biết đợi bao lâu thay vì đập lại ngay.
     */
    private AiServiceException rateLimitException(Integer retryAfterSeconds, Throwable cause) {
        int retryAfter = retryAfterSeconds != null ? retryAfterSeconds : DEFAULT_RATE_LIMIT_RETRY_AFTER_SECONDS;
        return new AiServiceException(AiErrorCode.RATE_LIMITED,
                "Trợ lý AI đang quá tải, vui lòng thử lại sau ít phút.", retryAfter, cause);
    }

    /**
     * Đọc {@code Retry-After} (giây) từ phản hồi 429. Groq trả số giây, có thể là phân số
     * ({@code "7.5"}) nên phải parse như số thực rồi làm tròn LÊN — làm tròn xuống là thử lại
     * sớm và ăn thêm một 429. Trả {@code null} khi thiếu header hoặc không đọc được (RFC cho
     * phép cả HTTP-date; ta không đoán, cứ coi như không có gợi ý).
     */
    static Integer parseRetryAfterSeconds(RestClientResponseException e) {
        HttpHeaders headers = e.getResponseHeaders();
        if (headers == null) {
            return null;
        }
        return parseRetryAfterSeconds(headers.getFirst(HttpHeaders.RETRY_AFTER));
    }

    static Integer parseRetryAfterSeconds(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            return null;
        }
        try {
            double seconds = Double.parseDouble(rawValue.trim());
            if (seconds < 0) {
                return null;
            }
            return (int) Math.max(1L, (long) Math.ceil(seconds));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    /**
     * Gói các header {@code x-ratelimit-*} vào một chuỗi log. Đây chính là thứ đã thiếu khi truy
     * sự cố 04/08: log chỉ có "429" trơ trọi nên không thể phân biệt "burst nhất thời" với "tài
     * khoản chạm trần tier", phải gọi tay API nhà cung cấp mới biết.
     */
    static String describeRateLimitHeaders(RestClientResponseException e) {
        HttpHeaders headers = e.getResponseHeaders();
        if (headers == null) {
            return "không có header hạn mức";
        }
        StringBuilder sb = new StringBuilder();
        for (String name : RATE_LIMIT_HEADERS) {
            String value = headers.getFirst(name);
            if (value != null) {
                if (sb.length() > 0) {
                    sb.append(", ");
                }
                sb.append(name).append('=').append(value);
            }
        }
        return sb.length() == 0 ? "không có header hạn mức" : sb.toString();
    }
}
