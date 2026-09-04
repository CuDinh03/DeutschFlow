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
 * Client for the OpenAI-compatible Whisper STT API (mặc định: Groq).
 * Endpoint mặc định: POST https://api.groq.com/openai/v1/audio/transcriptions
 * Model mặc định: whisper-large-v3
 *
 * <p><b>Đổi nhà cung cấp qua env, không sửa code</b> (bảo hiểm vendor — cùng lý do
 * {@code GROQ_BASE_URL} bên {@link GroqChatClient}): {@code GROQ_WHISPER_BASE_URL} +
 * {@code GROQ_WHISPER_MODEL}. Đã bench Fireworks 08/08/2026, hai bẫy khi trỏ sang đó:
 * <ul>
 *   <li>Audio KHÔNG đi {@code api.fireworks.ai} — mỗi model một host riêng:
 *       {@code whisper-v3-turbo} → {@code https://audio-turbo.us-virginia-1.direct.fireworks.ai/v1/audio/transcriptions},
 *       {@code whisper-v3} → {@code audio-prod...}. Nhầm host/model → 401 "Unauthorized"
 *       TRÔNG NHƯ lỗi key nhưng không phải. Bearer dùng được bình thường.</li>
 *   <li>Fireworks decode {@code prompt} theo semantics gốc Whisper ("văn bản đứng TRƯỚC audio"):
 *       prompt trùng nội dung audio thì phần trùng bị NUỐT khỏi transcript — học viên đọc đúng
 *       câu mẫu sẽ bị chấm MISSING toàn bộ. Bắt buộc {@code GROQ_WHISPER_PROMPT_ENABLED=false}
 *       khi trỏ Fireworks (Groq không dính nên mặc định vẫn gửi).</li>
 * </ul>
 */
@Component
@Slf4j
public class GroqWhisperClient {

    static final String WHISPER_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

    /** Per-request cap. The JDK HttpClient only had a connect timeout; without this a stalled
     *  Groq response would hold the STT thread (and its Whisper semaphore permit) indefinitely. */
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(60);

    /** Khớp gợi ý Retry-After của {@link GroqChatClient}: nghẽn cục bộ vài giây, breaker 30s. */
    private static final int BUSY_RETRY_AFTER_SECONDS = 15;
    private static final int BREAKER_OPEN_RETRY_AFTER_SECONDS = 30;
    /** 429 không kèm Retry-After: hạn mức STT của Groq tính theo giây-audio/giờ — 60s là mốc an toàn. */
    private static final int DEFAULT_RATE_LIMIT_RETRY_AFTER_SECONDS = 60;

    private final String apiKey;
    private final String endpointUrl;
    private final String whisperModel;
    /** Gửi {@code prompt} (expectedText) định hướng STT — tắt khi provider nuốt phần trùng (Fireworks). */
    private final boolean promptEnabled;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final GroqConcurrencyLimiter concurrencyLimiter;
    private final com.deutschflow.common.resilience.CircuitBreakers circuitBreakers;

    /** Constructor đầy đủ, {@code @Autowired} — cũng là cửa cho tests chỉnh endpoint + cờ prompt
     *  (xem {@code GroqWhisperClientVerboseParseTest}); production bind giá trị từ yml/env. */
    @org.springframework.beans.factory.annotation.Autowired
    public GroqWhisperClient(
            @Value("${app.ai.groq.api-key:}") String apiKey,
            @Value("${app.ai.groq.whisper-model:whisper-large-v3}") String whisperModel,
            ObjectMapper objectMapper,
            GroqConcurrencyLimiter concurrencyLimiter,
            com.deutschflow.common.resilience.CircuitBreakers circuitBreakers,
            @Value("${app.ai.groq.whisper-base-url:" + WHISPER_URL + "}") String endpointUrl,
            @Value("${app.ai.groq.whisper-prompt-enabled:true}") boolean promptEnabled) {
        this.apiKey = apiKey;
        this.endpointUrl = endpointUrl;
        this.whisperModel = whisperModel;
        this.promptEnabled = promptEnabled;
        this.objectMapper = objectMapper;
        this.concurrencyLimiter = concurrencyLimiter;
        this.circuitBreakers = circuitBreakers;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        log.info("GroqWhisperClient initialized — model: {}, endpoint: {}, prompt: {}",
                whisperModel, endpointUrl, promptEnabled ? "on" : "off");
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
        return new AiServiceException(AiErrorCode.AI_UPSTREAM_UNAVAILABLE,
                "Dịch vụ nhận diện giọng nói tạm thời không khả dụng, vui lòng thử lại sau.", null);
    }

    private AiServiceException transportFailure(String phase, Exception e) {
        log.error("[Whisper] {} error", phase, e);
        return new AiServiceException(AiErrorCode.AI_UPSTREAM_UNAVAILABLE,
                "Dịch vụ nhận diện giọng nói tạm thời không khả dụng, vui lòng thử lại sau.", null, e);
    }

    /**
     * 429 = chạm hạn mức tài khoản Groq (giây audio/giờ hoặc request/ngày), KHÔNG phải upstream
     * chết — cùng khuôn bản vá chat #288/#291. Mã {@code RATE_LIMITED} để handler phát
     * {@code Retry-After} + metric riêng, và predicate ở call-site giữ breaker đứng yên.
     */
    private AiServiceException rateLimited(String phase, HttpResponse<String> response) {
        Integer retryAfter = response.headers().firstValue("retry-after")
                .map(GroqChatClient::parseRetryAfterSeconds)
                .orElse(null);
        log.warn("[Whisper] 429 HẠN MỨC UPSTREAM ({}): Retry-After={} · {}", phase,
                retryAfter == null ? "(upstream không nói)" : retryAfter + "s",
                response.headers().map().entrySet().stream()
                        .filter(e -> e.getKey().toLowerCase(java.util.Locale.ROOT).startsWith("x-ratelimit"))
                        .map(e -> e.getKey() + "=" + String.join(",", e.getValue()))
                        .collect(java.util.stream.Collectors.joining(" ")));
        return new AiServiceException(AiErrorCode.RATE_LIMITED,
                "Hệ thống đang nhận quá nhiều bản ghi âm, vui lòng thử lại sau ít phút.",
                retryAfter != null ? retryAfter : DEFAULT_RATE_LIMIT_RETRY_AFTER_SECONDS);
    }

    public String getWhisperModel() {
        return whisperModel;
    }

    /** Word-level result from verbose transcription. */
    public record WordTimestamp(String word, double start, double end) {}

    /** Verbose transcript with segment-level confidence and per-word timestamps. */
    public record VerboseTranscript(String text, double avgLogprob, java.util.List<WordTimestamp> words, double durationSeconds) {}

    /** Text plus audio duration returned by {@link #transcribe}. */
    public record TranscribeResult(String text, double durationSeconds) {}

    /**
     * Transcribes with verbose_json + word timestamps for pronunciation scoring.
     */
    public VerboseTranscript transcribeVerbose(byte[] audioBytes, String filename, String language, String prompt) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new AiServiceException(AiErrorCode.AI_NOT_CONFIGURED,
                    "Tính năng nhận diện giọng nói chưa được bật trên hệ thống.", null);
        }

        String boundary = "----FormBoundary" + UUID.randomUUID().toString().replace("-", "");
        byte[] body = buildMultipartBody(boundary, audioBytes, filename, language, prompt, true);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpointUrl))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .timeout(REQUEST_TIMEOUT)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                .build();

        boolean acquired = false;
        try {
            acquired = concurrencyLimiter.tryAcquireWhisper();
            if (!acquired) throw new AiServiceException(AiErrorCode.AI_BUSY,
                    "Nhận diện giọng nói đang bận, vui lòng thử lại sau ít giây.", BUSY_RETRY_AFTER_SECONDS);
            // Circuit-breaker guarded (semaphore stays OUTSIDE — local backpressure ≠ upstream failure).
            return circuitBreakers.call(
                    "groqWhisper",
                    () -> sendAndParseVerbose(request),
                    () -> new AiServiceException(AiErrorCode.AI_BUSY,
                            "Nhận diện giọng nói đang quá tải, thử lại sau ít phút.", BREAKER_OPEN_RETRY_AFTER_SECONDS),
                    AiServiceException::isRateLimited);
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
    private VerboseTranscript sendAndParseVerbose(HttpRequest request) {
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() == 429) {
                throw rateLimited("verbose", response);
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

            return new VerboseTranscript(text.strip(), avgLogprob, words, durationSeconds);
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
     * Transcribes audio bytes using Groq Whisper.
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
        if (apiKey == null || apiKey.isBlank()) {
            throw new AiServiceException(AiErrorCode.AI_NOT_CONFIGURED,
                    "Tính năng nhận diện giọng nói chưa được bật trên hệ thống.", null);
        }

        String boundary = "----FormBoundary" + UUID.randomUUID().toString().replace("-", "");
        // verbose_json gives us the duration field without requesting word timestamps
        byte[] body = buildMultipartBody(boundary, audioBytes, filename, language, prompt, true);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpointUrl))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .timeout(REQUEST_TIMEOUT)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                .build();

        boolean acquired = false;
        try {
            acquired = concurrencyLimiter.tryAcquireWhisper();
            if (!acquired) {
                log.warn("[Whisper] Semaphore timeout — too many concurrent STT requests");
                throw new AiServiceException(AiErrorCode.AI_BUSY,
                        "Nhận diện giọng nói đang bận, vui lòng thử lại sau ít giây.", BUSY_RETRY_AFTER_SECONDS);
            }
            // Circuit-breaker guarded (semaphore stays OUTSIDE — local backpressure ≠ upstream failure).
            return circuitBreakers.call(
                    "groqWhisper",
                    () -> sendAndParseTranscribe(request, prompt, audioBytes.length),
                    () -> new AiServiceException(AiErrorCode.AI_BUSY,
                            "Nhận diện giọng nói đang quá tải, thử lại sau ít phút.", BREAKER_OPEN_RETRY_AFTER_SECONDS),
                    AiServiceException::isRateLimited);
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
    private TranscribeResult sendAndParseTranscribe(HttpRequest request, String prompt, int audioLen) {
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() == 429) {
                throw rateLimited("transcribe", response);
            }
            if (response.statusCode() != 200) {
                log.error("[Whisper] HTTP {}: {}", response.statusCode(), response.body());
                throw upstreamFailure("transcribe", response.statusCode());
            }
            JsonNode root = objectMapper.readTree(response.body());
            String text = root.path("text").asText(null);
            if (text == null || text.isBlank()) {
                throw new AiServiceException(AiErrorCode.STT_FAILED,
                        "Chưa nghe rõ — bạn nói lại hoặc gõ tay nhé.", null);
            }
            double durationSeconds = root.path("duration").asDouble(0);
            log.info("[Whisper] target='{}' -> transcribed='{}' ({} bytes, {}s)",
                    prompt != null ? prompt : "", text, audioLen,
                    String.format("%.2f", durationSeconds));
            return new TranscribeResult(text.strip(), durationSeconds);
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
        return buildMultipartBody(boundary, audioBytes, filename, language, prompt, false);
    }

    private byte[] buildMultipartBody(String boundary, byte[] audioBytes,
                                      String filename, String language, String prompt, boolean verbose) {
        try {
            String safeFilename = (filename != null && !filename.isBlank()) ? filename : "audio.webm";
            StringBuilder sb = new StringBuilder();

            // --- model field ---
            sb.append("--").append(boundary).append("\r\n");
            sb.append("Content-Disposition: form-data; name=\"model\"\r\n");
            sb.append("Content-Type: text/plain; charset=UTF-8\r\n\r\n");
            sb.append(whisperModel).append("\r\n");

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
