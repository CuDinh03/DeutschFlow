package com.deutschflow.speaking.ai;

import com.deutschflow.speaking.exception.AiErrorCode;
import com.deutschflow.speaking.exception.AiServiceException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;

/**
 * Client cho API nhận diện giọng nói (STT) kiểu OpenAI ({@code POST …/audio/transcriptions}, Bearer,
 * multipart). Tên lớp còn "Groq" vì lịch sử; nhà cung cấp chọn hoàn toàn qua env, không sửa code:
 * {@code STT_API_KEY}, {@code GROQ_WHISPER_BASE_URL}, {@code GROQ_WHISPER_MODEL},
 * {@code GROQ_WHISPER_PROMPT_ENABLED} (xem constructor Spring).
 *
 * <p><b>Chuỗi gọi cho một lượt nhận diện</b> (tối đa 3 lời gọi HTTP, tất cả nằm trong MỘT permit của
 * {@link GroqConcurrencyLimiter} và MỘT lượt circuit breaker {@code groqWhisper}):
 * <ol>
 *   <li>Model chính.</li>
 *   <li>Lỗi tạm thời (HTTP 429, 5xx, timeout/IO) → chuyển NGAY sang model dự phòng, không chờ.
 *       Dự phòng lấy từ {@code GROQ_WHISPER_FALLBACK_MODEL} / {@code GROQ_WHISPER_FALLBACK_BASE_URL};
 *       không đặt thì tự suy: host {@code api.groq.com} → {@code whisper-large-v3-turbo} ↔
 *       {@code whisper-large-v3} cùng URL (mỗi model một hạn mức request/phút riêng); host audio
 *       Fireworks → host anh em (turbo ↔ prod); còn lại = không có dự phòng.</li>
 *   <li>Chỉ khi model chính 429 kèm {@code retry-after} ≤ {@code GROQ_WHISPER_RETRY_MAX_WAIT_MS}
 *       VÀ dự phòng cũng 429 (hoặc không có dự phòng): chờ đúng thời gian đó rồi thử lại model chính
 *       MỘT lần. {@code retry-after} dài hơn ngưỡng thì không giữ thread — trả lỗi ngay.</li>
 * </ol>
 * Không chuyển dự phòng khi 400/413/415/422 (lỗi của bản ghi âm). 401/403 là lỗi CẤU HÌNH (khoá hoặc
 * host sai) — ghi log ERROR; chỉ thử dự phòng khi nó nằm ở URL KHÁC (cùng URL + cùng khoá thì chắc
 * chắn nhận lại 401).
 *
 * <p>Kết quả mang tên model THỰC SỰ trả lời ({@link TranscribeResult#model()},
 * {@link VerboseTranscript#model()}) để nơi gọi ghi sổ {@code stt_usage_events} đúng model.
 *
 * <p>Metric (Micrometer): {@code speaking.stt.rate_limited}, {@code speaking.stt.fallback},
 * {@code speaking.stt.failures} — nhãn {@code provider}, {@code model}.
 *
 * <p>Ghi chú di sản Fireworks (bench 08/08/2026; phần mã giữ lại để tương thích ngược khi env còn
 * trỏ tới đó):
 * <ul>
 *   <li>Audio KHÔNG đi {@code api.fireworks.ai} — mỗi model một host riêng:
 *       {@code whisper-v3-turbo} → {@code https://audio-turbo.us-virginia-1.direct.fireworks.ai/v1/audio/transcriptions},
 *       {@code whisper-v3} → {@code audio-prod...}. Nhầm host/model → 401 "Unauthorized"
 *       TRÔNG NHƯ lỗi key nhưng không phải.</li>
 *   <li>Fireworks decode {@code prompt} theo semantics gốc Whisper ("văn bản đứng TRƯỚC audio"):
 *       prompt trùng nội dung audio thì phần trùng bị NUỐT khỏi transcript. Bắt buộc
 *       {@code GROQ_WHISPER_PROMPT_ENABLED=false} khi trỏ Fireworks (Groq không dính nên mặc định vẫn gửi).</li>
 * </ul>
 */
@Component
@Slf4j
public class GroqWhisperClient {

    static final String WHISPER_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

    static final String GROQ_MODEL = "whisper-large-v3";
    static final String GROQ_TURBO_MODEL = "whisper-large-v3-turbo";
    static final String GROQ_HOST = "api.groq.com";
    /** Mặc định khi có {@code STT_API_KEY} mà không đặt URL/model tường minh (di sản 09/11/2026). */
    static final String FIREWORKS_TURBO_MODEL = "whisper-v3-turbo";
    static final String FIREWORKS_TURBO_URL =
            "https://audio-turbo.us-virginia-1.direct.fireworks.ai/v1/audio/transcriptions";

    /** Per-request cap. The JDK HttpClient only had a connect timeout; without this a stalled
     *  Groq response would hold the STT thread (and its Whisper semaphore permit) indefinitely. */
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(60);

    /** Khớp gợi ý Retry-After của {@link GroqChatClient}: nghẽn cục bộ vài giây, breaker 30s. */
    private static final int BUSY_RETRY_AFTER_SECONDS = 15;
    private static final int BREAKER_OPEN_RETRY_AFTER_SECONDS = 30;
    /** 429 không kèm Retry-After: hạn mức STT của Groq tính theo giây-audio/giờ — 60s là mốc an toàn. */
    private static final int DEFAULT_RATE_LIMIT_RETRY_AFTER_SECONDS = 60;
    /** Mặc định của {@code app.ai.groq.whisper-retry-max-wait-ms}. */
    static final long DEFAULT_RETRY_MAX_WAIT_MS = 1500;

    private final String apiKey;

    /** Một đích gọi STT kiểu OpenAI: nhãn nhà cung cấp (cho metric), URL, model. */
    record Target(String provider, String url, String model) {}

    private final Target primary;
    /**
     * Model dự phòng cùng nhà cung cấp (null = không có) — cấu hình tường minh, hoặc tự suy theo host
     * (xem {@link #resolveFallback}).
     */
    private final Target fallback;
    /** Trần thời gian (ms) chấp nhận chờ theo {@code retry-after} trước khi thử lại model chính; ≤ 0 = không chờ. */
    private final long retryMaxWaitMs;
    private final io.micrometer.core.instrument.MeterRegistry meterRegistry;
    /** Gửi {@code prompt} (expectedText) định hướng STT — tắt khi provider nuốt phần trùng (Fireworks). */
    private final boolean promptEnabled;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final GroqConcurrencyLimiter concurrencyLimiter;
    private final com.deutschflow.common.resilience.CircuitBreakers circuitBreakers;

    /**
     * Constructor Spring. Nhà cung cấp chọn qua env:
     * <ul>
     *   <li>{@code GROQ_WHISPER_BASE_URL / _MODEL / _PROMPT_ENABLED} đặt tường minh thì luôn thắng.</li>
     *   <li>Để trống: có {@code STT_API_KEY} → mặc định di sản (Fireworks whisper-v3-turbo, prompt TẮT);
     *       chưa có → Groq {@code whisper-large-v3} bằng khoá chat {@code GROQ_API_KEY}.</li>
     *   <li>{@code GROQ_WHISPER_FALLBACK_MODEL / _FALLBACK_BASE_URL}: model dự phòng tường minh; trống =
     *       tự suy theo host (xem javadoc lớp).</li>
     * </ul>
     */
    @org.springframework.beans.factory.annotation.Autowired
    public GroqWhisperClient(
            @Value("${app.ai.groq.api-key:}") String chatApiKey,
            @Value("${app.ai.groq.whisper-api-key:}") String sttApiKey,
            @Value("${app.ai.groq.whisper-model:}") String whisperModel,
            ObjectMapper objectMapper,
            GroqConcurrencyLimiter concurrencyLimiter,
            com.deutschflow.common.resilience.CircuitBreakers circuitBreakers,
            @Value("${app.ai.groq.whisper-base-url:}") String endpointUrl,
            @Value("${app.ai.groq.whisper-prompt-enabled:}") String promptEnabled,
            @Value("${app.ai.groq.whisper-fallback-model:}") String fallbackModel,
            @Value("${app.ai.groq.whisper-fallback-base-url:}") String fallbackBaseUrl,
            @Value("${app.ai.groq.whisper-retry-max-wait-ms:1500}") long retryMaxWaitMs,
            org.springframework.beans.factory.ObjectProvider<io.micrometer.core.instrument.MeterRegistry> meterRegistry) {
        this(isSet(sttApiKey) ? sttApiKey : chatApiKey,
                resolveModel(whisperModel, sttApiKey),
                objectMapper, concurrencyLimiter, circuitBreakers,
                resolveUrl(endpointUrl, sttApiKey),
                isSet(promptEnabled) ? Boolean.parseBoolean(promptEnabled.trim()) : !isSet(sttApiKey),
                resolveFallback(resolveUrl(endpointUrl, sttApiKey), resolveModel(whisperModel, sttApiKey),
                        fallbackModel, fallbackBaseUrl),
                retryMaxWaitMs,
                meterRegistry == null ? null : meterRegistry.getIfAvailable());
    }

    /** Chữ ký cũ của constructor Spring (trước khi có cấu hình dự phòng) — giữ cho test sẵn có. */
    GroqWhisperClient(
            String chatApiKey,
            String sttApiKey,
            String whisperModel,
            ObjectMapper objectMapper,
            GroqConcurrencyLimiter concurrencyLimiter,
            com.deutschflow.common.resilience.CircuitBreakers circuitBreakers,
            String endpointUrl,
            String promptEnabled) {
        this(chatApiKey, sttApiKey, whisperModel, objectMapper, concurrencyLimiter, circuitBreakers,
                endpointUrl, promptEnabled, "", "", DEFAULT_RETRY_MAX_WAIT_MS, null);
    }

    private static boolean isSet(String v) {
        return v != null && !v.isBlank();
    }

    private static String resolveModel(String whisperModel, String sttApiKey) {
        return isSet(whisperModel) ? whisperModel : (isSet(sttApiKey) ? FIREWORKS_TURBO_MODEL : GROQ_MODEL);
    }

    private static String resolveUrl(String endpointUrl, String sttApiKey) {
        return isSet(endpointUrl) ? endpointUrl : (isSet(sttApiKey) ? FIREWORKS_TURBO_URL : WHISPER_URL);
    }

    /** Constructor đầy đủ — cửa cho tests chỉnh endpoint + cờ prompt
     *  (xem {@code GroqWhisperClientVerboseParseTest}). Dự phòng tự suy theo host. */
    public GroqWhisperClient(
            String apiKey,
            String whisperModel,
            ObjectMapper objectMapper,
            GroqConcurrencyLimiter concurrencyLimiter,
            com.deutschflow.common.resilience.CircuitBreakers circuitBreakers,
            String endpointUrl,
            boolean promptEnabled) {
        this(apiKey, whisperModel, objectMapper, concurrencyLimiter, circuitBreakers, endpointUrl, promptEnabled,
                resolveFallback(endpointUrl, whisperModel, null, null));
    }

    /** Cửa cho test: chỉ định tường minh dự phòng {@code {url, model}} (null = không có). */
    GroqWhisperClient(
            String apiKey,
            String whisperModel,
            ObjectMapper objectMapper,
            GroqConcurrencyLimiter concurrencyLimiter,
            com.deutschflow.common.resilience.CircuitBreakers circuitBreakers,
            String endpointUrl,
            boolean promptEnabled,
            String[] fallback) {
        this(apiKey, whisperModel, objectMapper, concurrencyLimiter, circuitBreakers, endpointUrl, promptEnabled,
                fallback, DEFAULT_RETRY_MAX_WAIT_MS, null);
    }

    /** Constructor gốc — mọi constructor khác dồn về đây. {@code meterRegistry} null = registry tạm (test). */
    GroqWhisperClient(
            String apiKey,
            String whisperModel,
            ObjectMapper objectMapper,
            GroqConcurrencyLimiter concurrencyLimiter,
            com.deutschflow.common.resilience.CircuitBreakers circuitBreakers,
            String endpointUrl,
            boolean promptEnabled,
            String[] fallback,
            long retryMaxWaitMs,
            io.micrometer.core.instrument.MeterRegistry meterRegistry) {
        this.apiKey = apiKey;
        this.primary = new Target(providerOf(endpointUrl), endpointUrl, whisperModel);
        this.fallback = fallback == null ? null : new Target(providerOf(fallback[0]), fallback[0], fallback[1]);
        this.retryMaxWaitMs = retryMaxWaitMs;
        this.meterRegistry = meterRegistry != null ? meterRegistry
                : new io.micrometer.core.instrument.simple.SimpleMeterRegistry();
        this.promptEnabled = promptEnabled;
        this.objectMapper = objectMapper;
        this.concurrencyLimiter = concurrencyLimiter;
        this.circuitBreakers = circuitBreakers;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        log.info("GroqWhisperClient initialized — model: {}, endpoint: {}, prompt: {}, fallback: {}, retryMaxWaitMs: {}",
                whisperModel, endpointUrl, promptEnabled ? "on" : "off",
                this.fallback == null ? "none" : this.fallback.model() + " @ " + this.fallback.url(), retryMaxWaitMs);
    }

    private static final String FW_TURBO_HOST = "//audio-turbo.";
    private static final String FW_PROD_HOST = "//audio-prod.";

    /** Host audio Fireworks còn lại cho {@code url} (turbo ↔ prod) kèm model; null nếu không phải host audio Fireworks. */
    static String[] fireworksSibling(String url) {
        if (url == null || !url.contains(".direct.fireworks.ai/")) return null;
        if (url.contains(FW_TURBO_HOST)) return new String[]{url.replace(FW_TURBO_HOST, FW_PROD_HOST), "whisper-v3"};
        if (url.contains(FW_PROD_HOST)) return new String[]{url.replace(FW_PROD_HOST, FW_TURBO_HOST), "whisper-v3-turbo"};
        return null;
    }

    /** Model Groq còn lại (turbo ↔ large-v3) cùng URL; null nếu {@code url} không phải host Groq hoặc model lạ. */
    static String[] groqSibling(String url, String model) {
        if (!GROQ_HOST.equals(hostOf(url)) || model == null) return null;
        if (GROQ_TURBO_MODEL.equals(model.trim())) return new String[]{url, GROQ_MODEL};
        if (GROQ_MODEL.equals(model.trim())) return new String[]{url, GROQ_TURBO_MODEL};
        return null;
    }

    /**
     * Dự phòng {@code {url, model}} cho model chính, hoặc null. Cấu hình tường minh thắng suy diễn:
     * có {@code cfgModel} và/hoặc {@code cfgUrl} thì dùng chúng (phần để trống lấy theo model chính);
     * không đặt gì thì suy theo host — Groq ({@link #groqSibling}) rồi Fireworks ({@link #fireworksSibling}).
     * Dự phòng trùng hệt model chính (cùng URL, cùng model) bị bỏ vì gọi lại chỉ tốn hạn mức.
     */
    static String[] resolveFallback(String primaryUrl, String primaryModel, String cfgModel, String cfgUrl) {
        String[] resolved;
        if (isSet(cfgModel) || isSet(cfgUrl)) {
            resolved = new String[]{isSet(cfgUrl) ? cfgUrl.trim() : primaryUrl,
                    isSet(cfgModel) ? cfgModel.trim() : primaryModel};
        } else {
            resolved = groqSibling(primaryUrl, primaryModel);
            if (resolved == null) resolved = fireworksSibling(primaryUrl);
        }
        if (resolved == null) return null;
        if (java.util.Objects.equals(resolved[0], primaryUrl) && java.util.Objects.equals(resolved[1], primaryModel)) {
            return null;
        }
        return resolved;
    }

    private static String hostOf(String url) {
        try {
            String host = url == null ? null : URI.create(url.trim()).getHost();
            return host == null ? "" : host.toLowerCase(java.util.Locale.ROOT);
        } catch (IllegalArgumentException e) {
            return "";
        }
    }

    /** Nhãn {@code provider} của metric — tập giá trị cố định để không nổ cardinality. */
    static String providerOf(String url) {
        String host = hostOf(url);
        if (host.equals("groq.com") || host.endsWith(".groq.com")) return "groq";
        if (host.equals("fireworks.ai") || host.endsWith(".fireworks.ai")) return "fireworks";
        return "custom";
    }

    private HttpRequest buildRequest(Target target, byte[] audioBytes, String filename,
                                     String language, String prompt) {
        String boundary = "----FormBoundary" + UUID.randomUUID().toString().replace("-", "");
        byte[] body = buildMultipartBody(boundary, audioBytes, filename, language, prompt, true, target.model());
        return HttpRequest.newBuilder()
                .uri(URI.create(target.url()))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .timeout(REQUEST_TIMEOUT)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                .build();
    }

    /** Phân loại lỗi của MỘT lời gọi — quyết định bước kế trong chuỗi dự phòng. */
    enum FailureKind {
        /** HTTP 429 — hạn mức theo phút của model này. */
        RATE_LIMITED,
        /** 5xx, timeout, lỗi kết nối, thân 200 không đọc được. */
        TRANSIENT,
        /** 401/403 — khoá hoặc host sai. */
        AUTH,
        /** 400/413/415/422 hoặc transcript rỗng — lỗi của bản ghi, đích nào cũng trả y vậy. */
        AUDIO,
        /** Bị ngắt (interrupt) v.v. — dừng chuỗi ngay. */
        OTHER;

        boolean mayTryNext() {
            return this == RATE_LIMITED || this == TRANSIENT || this == AUTH;
        }
    }

    /** {@link AiServiceException} kèm phân loại nội bộ; nơi gọi chỉ thấy mã/câu chữ như trước. */
    static final class AttemptFailure extends AiServiceException
            implements com.deutschflow.ai.trace.AiCallTrace.HttpStatusCarrier {
        private final transient FailureKind kind;
        /** {@code retry-after} của upstream tính bằng ms; null nếu không có/không đọc được. */
        private final transient Long retryAfterMillis;
        /** Mã HTTP upstream trả (null = không có phản hồi HTTP: timeout, lỗi kết nối, thân rỗng) — cho nhật ký gọi AI. */
        private final transient Integer httpStatus;

        AttemptFailure(FailureKind kind, Long retryAfterMillis, AiErrorCode code, String message,
                       Integer retryAfterSeconds, Throwable cause) {
            this(kind, retryAfterMillis, null, code, message, retryAfterSeconds, cause);
        }

        AttemptFailure(FailureKind kind, Long retryAfterMillis, Integer httpStatus, AiErrorCode code, String message,
                       Integer retryAfterSeconds, Throwable cause) {
            super(code, message, retryAfterSeconds, cause);
            this.kind = kind;
            this.retryAfterMillis = retryAfterMillis;
            this.httpStatus = httpStatus;
        }

        @Override
        public Integer httpStatus() {
            return httpStatus;
        }
    }

    private static FailureKind kindOf(AiServiceException e) {
        return e instanceof AttemptFailure af ? af.kind : FailureKind.OTHER;
    }

    private void count(String name, Target target, String... extraTags) {
        String[] tags = new String[4 + extraTags.length];
        tags[0] = "provider";
        tags[1] = target.provider();
        tags[2] = "model";
        tags[3] = target.model() == null ? "unknown" : target.model();
        System.arraycopy(extraTags, 0, tags, 4, extraTags.length);
        meterRegistry.counter(name, tags).increment();
    }

    /** Gọi một đích; đếm 429 và ghi log ERROR cho 401/403 ngay tại chỗ. */
    private <T> T attempt(java.util.function.Function<Target, T> send, Target target) {
        try {
            return send.apply(target);
        } catch (AiServiceException e) {
            FailureKind kind = kindOf(e);
            if (kind == FailureKind.RATE_LIMITED) {
                count("speaking.stt.rate_limited", target);
            } else if (kind == FailureKind.AUTH) {
                log.error("[Whisper] LỖI CẤU HÌNH STT: {} từ chối xác thực (401/403) cho model {} @ {} — "
                                + "kiểm tra STT_API_KEY/GROQ_API_KEY và GROQ_WHISPER_BASE_URL/GROQ_WHISPER_MODEL.",
                        target.provider(), target.model(), target.url());
            }
            throw e;
        }
    }

    /** Lỗi không cho đi tiếp trong chuỗi: đếm (trừ lỗi của bản ghi âm) rồi trả nguyên cho nơi gọi. */
    private AiServiceException terminal(AiServiceException e) {
        if (kindOf(e) != FailureKind.AUDIO) {
            count("speaking.stt.failures", primary, "code", e.getCode().name());
        }
        return e;
    }

    /**
     * Chuỗi gọi của một lượt nhận diện (xem javadoc lớp): chính → dự phòng (ngay, không chờ) →
     * chờ {@code retry-after} ngắn rồi chính lần nữa. Tối đa 3 lời gọi HTTP.
     */
    private <T> T withFallback(java.util.function.Function<Target, T> send,
                               com.deutschflow.ai.trace.AiCallTrace trace) {
        java.util.List<AiServiceException> failures = new java.util.ArrayList<>(3);
        AiServiceException first;
        long primaryFailedAtNanos;
        try {
            return attempt(send, primary);
        } catch (AiServiceException e) {
            first = e;
            primaryFailedAtNanos = System.nanoTime();
        }
        FailureKind firstKind = kindOf(first);
        if (!firstKind.mayTryNext()) throw terminal(first);
        failures.add(first);

        // 401/403 với dự phòng CÙNG URL (cùng khoá) chắc chắn nhận lại 401 — không gọi cho tốn lượt.
        boolean tryFallback = fallback != null
                && (firstKind != FailureKind.AUTH || !fallback.url().equals(primary.url()));
        // Điều kiện "mọi đích còn lại cũng 429" để được chờ rồi thử lại model chính.
        boolean othersAlsoRateLimited = true;
        if (tryFallback) {
            log.warn("[Whisper] model chính {} hỏng ({}) — thử dự phòng {} @ {}",
                    primary.model(), firstKind, fallback.model(), fallback.url());
            trace.fallback(fallback.url(), fallback.model());
            try {
                T result = attempt(send, fallback);
                count("speaking.stt.fallback", fallback, "outcome", "success");
                return result;
            } catch (AiServiceException e) {
                count("speaking.stt.fallback", fallback, "outcome", "failure");
                if (!kindOf(e).mayTryNext()) throw terminal(e);
                failures.add(e);
                othersAlsoRateLimited = kindOf(e) == FailureKind.RATE_LIMITED;
            }
        }

        Long retryAfterMillis = first instanceof AttemptFailure af ? af.retryAfterMillis : null;
        if (firstKind == FailureKind.RATE_LIMITED && othersAlsoRateLimited
                && retryAfterMillis != null && retryMaxWaitMs > 0 && retryAfterMillis <= retryMaxWaitMs) {
            long elapsedMillis = (System.nanoTime() - primaryFailedAtNanos) / 1_000_000L;
            long waitMillis = Math.max(0, retryAfterMillis - elapsedMillis);
            log.warn("[Whisper] mọi model đều 429 — chờ {}ms (retry-after {}ms) rồi thử lại {} một lần",
                    waitMillis, retryAfterMillis, primary.model());
            try {
                if (waitMillis > 0) Thread.sleep(waitMillis);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw new AiServiceException(AiErrorCode.AI_INTERRUPTED,
                        "Yêu cầu nhận diện giọng nói bị gián đoạn, vui lòng thử lại.", null, ie);
            }
            trace.retry(primary.url(), primary.model());
            try {
                return attempt(send, primary);
            } catch (AiServiceException e) {
                if (!kindOf(e).mayTryNext()) throw terminal(e);
                failures.add(e);
            }
        }

        AiServiceException finalFailure = finalFailure(failures);
        count("speaking.stt.failures", primary, "code", finalFailure.getCode().name());
        throw finalFailure;
    }

    /**
     * Lỗi trả cho nơi gọi khi cả chuỗi hỏng. Có bất kỳ lượt nào 429 → {@code RATE_LIMITED} với
     * {@code Retry-After} NHỎ NHẤT (upstream còn sống, chỉ là hết hạn mức phút — và breaker không đếm);
     * ngược lại là lỗi của lượt cuối, đúng như trước.
     */
    private static AiServiceException finalFailure(java.util.List<AiServiceException> failures) {
        AiServiceException rateLimited = null;
        for (AiServiceException f : failures) {
            if (!AiServiceException.isRateLimited(f)) continue;
            if (rateLimited == null || (f.getRetryAfterSeconds() != null && rateLimited.getRetryAfterSeconds() != null
                    && f.getRetryAfterSeconds() < rateLimited.getRetryAfterSeconds())) {
                rateLimited = f;
            }
        }
        return rateLimited != null ? rateLimited : failures.get(failures.size() - 1);
    }

    /** Endpoint-overridable — tests cũ trỏ stub HTTP cục bộ (xem {@code GroqWhisperClientErrorTest}),
     *  hành vi prompt giữ mặc định (on) như trước. */
    GroqWhisperClient(
            String apiKey,
            String whisperModel,
            ObjectMapper objectMapper,
            GroqConcurrencyLimiter concurrencyLimiter,
            com.deutschflow.common.resilience.CircuitBreakers circuitBreakers,
            String endpointUrl) {
        this(apiKey, whisperModel, objectMapper, concurrencyLimiter, circuitBreakers, endpointUrl, true);
    }

    /**
     * Audit speaking 24/07 (§8.1/§8.2): {@code detail} của ProblemDetail hiện thẳng lên UI, nên câu
     * chữ ở đây phải trung tính — không tên nhà cung cấp ("Whisper"/"Groq"), không mã HTTP trần,
     * không nguyên văn lỗi upstream. #252 đã dọn {@link GroqChatClient} nhưng bỏ sót client này:
     * "Whisper transcription failed: HTTP 500" và "Whisper verbose error: {message}" vẫn tới người
     * dùng. Chi tiết kỹ thuật chuyển hết vào log.
     */
    private AiServiceException upstreamFailure(String phase, int statusCode) {
        log.error("[Whisper] {} failed: HTTP {}", phase, statusCode);
        // 401/403 giữ nguyên mã AI_UPSTREAM_UNAVAILABLE với nơi gọi (người học không sửa được khoá),
        // chỉ khác phân loại nội bộ để chuỗi dự phòng xử lý riêng. Mã ngoài 2xx còn lại (3xx, 404…)
        // coi như tạm thời — đúng hành vi cũ (mọi mã khác 200 đều chuyển dự phòng).
        FailureKind kind = (statusCode == 401 || statusCode == 403) ? FailureKind.AUTH : FailureKind.TRANSIENT;
        return new AttemptFailure(kind, null, statusCode, AiErrorCode.AI_UPSTREAM_UNAVAILABLE,
                "Dịch vụ nhận diện giọng nói tạm thời không khả dụng, vui lòng thử lại sau.", null, null);
    }

    /** 400/413/415/422 = provider không đọc được file (container lạ, rỗng, quá lớn) — lỗi của bản ghi, không phải dịch vụ sập. */
    private static boolean isUnreadableAudio(int status) {
        return status == 400 || status == 413 || status == 415 || status == 422;
    }

    private AiServiceException unreadableAudio(String phase, HttpResponse<String> response) {
        String body = response.body() == null ? "" : response.body();
        log.warn("[Whisper] {} audio không đọc được: HTTP {} {}", phase, response.statusCode(),
                body.length() > 300 ? body.substring(0, 300) : body);
        return new AttemptFailure(FailureKind.AUDIO, null, response.statusCode(), AiErrorCode.STT_FAILED,
                "Không đọc được bản ghi âm — bạn thử ghi lại nhé.", null, null);
    }

    private AiServiceException transportFailure(String phase, Exception e) {
        log.error("[Whisper] {} error", phase, e);
        return new AttemptFailure(FailureKind.TRANSIENT, null, AiErrorCode.AI_UPSTREAM_UNAVAILABLE,
                "Dịch vụ nhận diện giọng nói tạm thời không khả dụng, vui lòng thử lại sau.", null, e);
    }

    /**
     * 429 = chạm hạn mức tài khoản (request/phút của từng model, giây audio/giờ…), KHÔNG phải upstream
     * chết — cùng khuôn bản vá chat #288/#291. Mã {@code RATE_LIMITED} để handler phát
     * {@code Retry-After} + metric riêng, và predicate ở call-site giữ breaker đứng yên.
     */
    private AiServiceException rateLimited(String phase, HttpResponse<String> response) {
        String rawRetryAfter = response.headers().firstValue("retry-after").orElse(null);
        Integer retryAfter = GroqChatClient.parseRetryAfterSeconds(rawRetryAfter);
        log.warn("[Whisper] 429 HẠN MỨC UPSTREAM ({}): Retry-After={} · {}", phase,
                retryAfter == null ? "(upstream không nói)" : retryAfter + "s",
                response.headers().map().entrySet().stream()
                        .filter(e -> e.getKey().toLowerCase(java.util.Locale.ROOT).startsWith("x-ratelimit"))
                        .map(e -> e.getKey() + "=" + String.join(",", e.getValue()))
                        .collect(java.util.stream.Collectors.joining(" ")));
        return new AttemptFailure(FailureKind.RATE_LIMITED, parseRetryAfterMillis(rawRetryAfter), 429,
                AiErrorCode.RATE_LIMITED,
                "Hệ thống đang nhận quá nhiều bản ghi âm, vui lòng thử lại sau ít phút.",
                retryAfter != null ? retryAfter : DEFAULT_RATE_LIMIT_RETRY_AFTER_SECONDS, null);
    }

    /** {@code retry-after} dạng số giây (cho phép thập phân) → ms; null nếu thiếu, âm hoặc là dạng ngày-giờ HTTP. */
    static Long parseRetryAfterMillis(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) return null;
        try {
            double seconds = Double.parseDouble(rawValue.trim());
            if (seconds < 0 || Double.isNaN(seconds) || Double.isInfinite(seconds)) return null;
            return (long) Math.ceil(seconds * 1000d);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    /**
     * Bọc một lượt nhận diện bằng nhật ký gọi AI: một dòng cho cả chuỗi chính → dự phòng → thử lại, ghi đích
     * cuối cùng đã gọi, số lần gọi HTTP và số lần chuyển dự phòng.
     */
    private <T> T traced(String feature,
                         java.util.function.Function<com.deutschflow.ai.trace.AiCallTrace, T> body) {
        com.deutschflow.ai.trace.AiCallTrace trace =
                com.deutschflow.ai.trace.AiCallTrace.start(feature, primary.url(), primary.model());
        try {
            T result = body.apply(trace);
            trace.ok();
            return result;
        } catch (RuntimeException e) {
            trace.fail(e);
            throw e;
        }
    }

    /** Hàng chờ STT đầy (chưa gọi ra ngoài): vẫn ghi một dòng nhật ký {@code result=ai_busy} để thấy quá tải. */
    private AiServiceException busy(String feature) {
        AiServiceException e = new AiServiceException(AiErrorCode.AI_BUSY,
                "Nhận diện giọng nói đang bận, vui lòng thử lại sau ít giây.", BUSY_RETRY_AFTER_SECONDS);
        com.deutschflow.ai.trace.AiCallTrace.start(feature, primary.url(), primary.model()).fail(e);
        return e;
    }

    /** Model CHÍNH theo cấu hình. Model thực sự trả lời một lượt nằm ở {@code model()} của kết quả. */
    public String getWhisperModel() {
        return primary.model();
    }

    /** Word-level result from verbose transcription. */
    public record WordTimestamp(String word, double start, double end) {}

    /**
     * Verbose transcript with segment-level confidence and per-word timestamps.
     * {@code model} = model thực sự trả kết quả (null với kết quả dựng tay trong test).
     */
    public record VerboseTranscript(String text, double avgLogprob, java.util.List<WordTimestamp> words,
                                    double durationSeconds, String model) {
        public VerboseTranscript(String text, double avgLogprob, java.util.List<WordTimestamp> words, double durationSeconds) {
            this(text, avgLogprob, words, durationSeconds, null);
        }

        /** Tên model để ghi sổ: model thực sự trả lời, không có thì {@code fallback}. */
        public String modelOr(String fallback) {
            return model != null && !model.isBlank() ? model : fallback;
        }
    }

    /**
     * Text plus audio duration returned by {@link #transcribe}.
     * {@code model} = model thực sự trả kết quả (null với kết quả dựng tay trong test).
     */
    public record TranscribeResult(String text, double durationSeconds, String model) {
        public TranscribeResult(String text, double durationSeconds) {
            this(text, durationSeconds, null);
        }

        /** Tên model để ghi sổ: model thực sự trả lời, không có thì {@code fallback}. */
        public String modelOr(String fallback) {
            return model != null && !model.isBlank() ? model : fallback;
        }
    }

    /**
     * Transcribes with verbose_json + word timestamps for pronunciation scoring.
     */
    public VerboseTranscript transcribeVerbose(byte[] audioBytes, String filename, String language, String prompt) {
        com.deutschflow.common.security.support.SupportSessionContextHolder.assertNotSupportSession("stt");
        if (apiKey == null || apiKey.isBlank()) {
            throw new AiServiceException(AiErrorCode.AI_NOT_CONFIGURED,
                    "Tính năng nhận diện giọng nói chưa được bật trên hệ thống.", null);
        }

        boolean acquired = false;
        try {
            acquired = concurrencyLimiter.tryAcquireWhisper();
            if (!acquired) throw busy("stt-verbose");
            // Circuit-breaker guarded (semaphore stays OUTSIDE — local backpressure ≠ upstream failure).
            return traced("stt-verbose", trace -> circuitBreakers.call(
                    "groqWhisper",
                    () -> withFallback(t -> sendAndParseVerbose(
                            buildRequest(t, audioBytes, filename, language, prompt), t.model()), trace),
                    () -> new AiServiceException(AiErrorCode.AI_BUSY,
                            "Nhận diện giọng nói đang quá tải, thử lại sau ít phút.", BREAKER_OPEN_RETRY_AFTER_SECONDS),
                    AiServiceException::isRateLimited));
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new AiServiceException(AiErrorCode.AI_INTERRUPTED,
                    "Yêu cầu nhận diện giọng nói bị gián đoạn, vui lòng thử lại.", null, ie);
        } finally {
            if (acquired) concurrencyLimiter.releaseWhisper();
        }
    }

    /** Sends the Whisper request and parses the verbose JSON. Converts checked exceptions to
     *  AiServiceException so the circuit breaker only ever sees (and counts) RuntimeExceptions. */
    private VerboseTranscript sendAndParseVerbose(HttpRequest request, String model) {
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() == 429) {
                throw rateLimited("verbose", response);
            }
            if (isUnreadableAudio(response.statusCode())) {
                throw unreadableAudio("verbose", response);
            }
            if (response.statusCode() != 200) {
                throw upstreamFailure("verbose", response.statusCode());
            }
            JsonNode root = objectMapper.readTree(response.body());
            String text = root.path("text").asText("");
            double durationSeconds = root.path("duration").asDouble(0);

            // Extract word timestamps
            java.util.List<WordTimestamp> words = new java.util.ArrayList<>();
            JsonNode wordsNode = root.path("words");
            if (wordsNode.isArray()) {
                for (JsonNode w : wordsNode) {
                    words.add(new WordTimestamp(
                            w.path("word").asText("").strip(),
                            w.path("start").asDouble(0),
                            w.path("end").asDouble(0)));
                }
            }

            // Confidence: Groq trả segments[].avg_logprob; Fireworks KHÔNG có segments nhưng có
            // words[].probability — suy avg_logprob = trung bình ln(p) để PronunciationScorerService
            // giữ nguyên thang điểm calibration dù trỏ provider nào.
            double avgLogprob = -0.3;
            JsonNode segments = root.path("segments");
            if (segments.isArray() && !segments.isEmpty()) {
                double sum = 0;
                for (JsonNode seg : segments) sum += seg.path("avg_logprob").asDouble(-0.3);
                avgLogprob = sum / segments.size();
            } else if (wordsNode.isArray()) {
                double sum = 0;
                int counted = 0;
                for (JsonNode w : wordsNode) {
                    if (!w.has("probability")) continue;
                    double p = Math.min(1.0, Math.max(1e-6, w.path("probability").asDouble(0)));
                    sum += Math.log(p);
                    counted++;
                }
                if (counted > 0) avgLogprob = sum / counted;
            }

            return new VerboseTranscript(text.strip(), avgLogprob, words, durationSeconds, model);
        } catch (AiServiceException e) {
            throw e;
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new AiServiceException(AiErrorCode.AI_INTERRUPTED,
                    "Yêu cầu nhận diện giọng nói bị gián đoạn, vui lòng thử lại.", null, ie);
        } catch (Exception e) {
            throw transportFailure("verbose", e);
        }
    }

    /**
     * Transcribes audio bytes qua nhà cung cấp STT đang cấu hình (kèm chuỗi dự phòng — xem javadoc lớp).
     *
     * <p>Uses {@code verbose_json} response format to capture audio duration alongside the
     * transcript text. The duration is returned so callers can record STT spend.
     *
     * @param audioBytes raw audio bytes (webm, mp4, wav, etc.)
     * @param filename   original filename (used to hint codec to Groq, e.g. "voice.webm")
     * @param language   BCP-47 language code to hint the model (e.g. "de")
     * @param prompt     optional context prompt to guide transcription (e.g., the target text)
     * @return transcribed text and audio duration in seconds
     */
    public TranscribeResult transcribe(byte[] audioBytes, String filename, String language, String prompt) {
        com.deutschflow.common.security.support.SupportSessionContextHolder.assertNotSupportSession("stt");
        if (apiKey == null || apiKey.isBlank()) {
            throw new AiServiceException(AiErrorCode.AI_NOT_CONFIGURED,
                    "Tính năng nhận diện giọng nói chưa được bật trên hệ thống.", null);
        }

        boolean acquired = false;
        try {
            acquired = concurrencyLimiter.tryAcquireWhisper();
            if (!acquired) {
                log.warn("[Whisper] Semaphore timeout — too many concurrent STT requests");
                throw busy("stt");
            }
            // Circuit-breaker guarded (semaphore stays OUTSIDE — local backpressure ≠ upstream failure).
            return traced("stt", trace -> circuitBreakers.call(
                    "groqWhisper",
                    () -> withFallback(t -> sendAndParseTranscribe(
                            buildRequest(t, audioBytes, filename, language, prompt), prompt, audioBytes.length, t.model()),
                            trace),
                    () -> new AiServiceException(AiErrorCode.AI_BUSY,
                            "Nhận diện giọng nói đang quá tải, thử lại sau ít phút.", BREAKER_OPEN_RETRY_AFTER_SECONDS),
                    AiServiceException::isRateLimited));
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new AiServiceException(AiErrorCode.AI_INTERRUPTED,
                    "Yêu cầu nhận diện giọng nói bị gián đoạn, vui lòng thử lại.", null, ie);
        } finally {
            if (acquired) {
                concurrencyLimiter.releaseWhisper();
            }
        }
    }

    /** Sends the Whisper request and parses the JSON. Converts checked exceptions to
     *  AiServiceException so the circuit breaker only ever sees (and counts) RuntimeExceptions. */
    private TranscribeResult sendAndParseTranscribe(HttpRequest request, String prompt, int audioLen, String model) {
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() == 429) {
                throw rateLimited("transcribe", response);
            }
            if (isUnreadableAudio(response.statusCode())) {
                throw unreadableAudio("transcribe", response);
            }
            if (response.statusCode() != 200) {
                log.error("[Whisper] HTTP {}: {}", response.statusCode(), response.body());
                throw upstreamFailure("transcribe", response.statusCode());
            }
            JsonNode root = objectMapper.readTree(response.body());
            String text = root.path("text").asText(null);
            if (text == null || text.isBlank()) {
                throw new AttemptFailure(FailureKind.AUDIO, null, AiErrorCode.STT_FAILED,
                        "Chưa nghe rõ — bạn nói lại hoặc gõ tay nhé.", null, null);
            }
            double durationSeconds = root.path("duration").asDouble(0);
            log.info("[Whisper] target='{}' -> transcribed='{}' ({} bytes, {}s, model {})",
                    prompt != null ? prompt : "", text, audioLen,
                    String.format("%.2f", durationSeconds), model);
            return new TranscribeResult(text.strip(), durationSeconds, model);
        } catch (AiServiceException e) {
            throw e;
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new AiServiceException(AiErrorCode.AI_INTERRUPTED,
                    "Yêu cầu nhận diện giọng nói bị gián đoạn, vui lòng thử lại.", null, ie);
        } catch (Exception e) {
            throw transportFailure("transcribe", e);
        }
    }

    // -----------------------------------------------------------------------
    // Build multipart/form-data body manually (no external dependency)
    // -----------------------------------------------------------------------

    private byte[] buildMultipartBody(String boundary, byte[] audioBytes,
                                      String filename, String language, String prompt) {
        return buildMultipartBody(boundary, audioBytes, filename, language, prompt, false, primary.model());
    }

    private byte[] buildMultipartBody(String boundary, byte[] audioBytes,
                                      String filename, String language, String prompt, boolean verbose,
                                      String model) {
        try {
            String safeFilename = (filename != null && !filename.isBlank()) ? filename : "audio.webm";
            StringBuilder sb = new StringBuilder();

            // --- model field ---
            sb.append("--").append(boundary).append("\r\n");
            sb.append("Content-Disposition: form-data; name=\"model\"\r\n");
            sb.append("Content-Type: text/plain; charset=UTF-8\r\n\r\n");
            sb.append(model).append("\r\n");

            // --- language field ---
            sb.append("--").append(boundary).append("\r\n");
            sb.append("Content-Disposition: form-data; name=\"language\"\r\n");
            sb.append("Content-Type: text/plain; charset=UTF-8\r\n\r\n");
            sb.append(language != null ? language : "de").append("\r\n");

            // --- response_format ---
            sb.append("--").append(boundary).append("\r\n");
            sb.append("Content-Disposition: form-data; name=\"response_format\"\r\n");
            sb.append("Content-Type: text/plain; charset=UTF-8\r\n\r\n");
            sb.append(verbose ? "verbose_json" : "json").append("\r\n");

            // --- timestamp_granularities for word-level data (verbose only) ---
            if (verbose) {
                sb.append("--").append(boundary).append("\r\n");
                sb.append("Content-Disposition: form-data; name=\"timestamp_granularities[]\"\r\n");
                sb.append("Content-Type: text/plain; charset=UTF-8\r\n\r\n");
                sb.append("word\r\n");
            }

            // --- temperature (0.0 forces deterministic transcription) ---
            sb.append("--").append(boundary).append("\r\n");
            sb.append("Content-Disposition: form-data; name=\"temperature\"\r\n");
            sb.append("Content-Type: text/plain; charset=UTF-8\r\n\r\n");
            sb.append("0.0\r\n");

            // --- prompt: must declare charset so the server interprets ü/ä/ö/ß bytes as UTF-8.
            //     Gate promptEnabled: provider decode prompt theo semantics "văn bản đứng trước
            //     audio" (Fireworks) sẽ NUỐT phần transcript trùng prompt — xem javadoc class. ---
            if (promptEnabled && prompt != null && !prompt.isBlank()) {
                sb.append("--").append(boundary).append("\r\n");
                sb.append("Content-Disposition: form-data; name=\"prompt\"\r\n");
                sb.append("Content-Type: text/plain; charset=UTF-8\r\n\r\n");
                sb.append(prompt).append("\r\n");
            }

            // --- file header ---
            sb.append("--").append(boundary).append("\r\n");
            sb.append("Content-Disposition: form-data; name=\"file\"; filename=\"")
              .append(safeFilename).append("\"\r\n");
            sb.append("Content-Type: application/octet-stream\r\n\r\n");

            byte[] prefix = sb.toString().getBytes(StandardCharsets.UTF_8);
            byte[] suffix = ("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8);

            byte[] combined = new byte[prefix.length + audioBytes.length + suffix.length];
            System.arraycopy(prefix, 0, combined, 0, prefix.length);
            System.arraycopy(audioBytes, 0, combined, prefix.length, audioBytes.length);
            System.arraycopy(suffix, 0, combined, prefix.length + audioBytes.length, suffix.length);
            return combined;
        } catch (Exception e) {
            throw new AiServiceException(AiErrorCode.STT_FAILED,
                    "Không đọc được bản ghi âm, bạn thử ghi lại nhé.", null, e);
        }
    }
}
