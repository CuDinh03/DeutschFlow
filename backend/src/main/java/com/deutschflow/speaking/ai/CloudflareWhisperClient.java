package com.deutschflow.speaking.ai;

import com.deutschflow.speaking.ai.GroqWhisperClient.TranscribeResult;
import com.deutschflow.speaking.ai.GroqWhisperClient.VerboseTranscript;
import com.deutschflow.speaking.ai.GroqWhisperClient.WordTimestamp;
import com.deutschflow.speaking.exception.AiErrorCode;
import com.deutschflow.speaking.exception.AiServiceException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

/**
 * Đường STT dự phòng KHÁC nhà cung cấp: Cloudflare Workers AI, model
 * {@code @cf/openai/whisper-large-v3-turbo}. Không được gọi trực tiếp từ nghiệp vụ — chỉ
 * {@link GroqWhisperClient} gọi ở cuối chuỗi dự phòng, và kết quả được chuyển về đúng kiểu
 * {@link TranscribeResult} / {@link VerboseTranscript} mà nơi gọi đang dùng.
 *
 * <p><b>Tắt mặc định</b>: thiếu {@code CF_AI_ACCOUNT_ID} hoặc {@code CF_AI_API_TOKEN} thì
 * {@link #isConfigured()} = false và không có lời gọi HTTP nào được tạo.
 *
 * <p>Viết theo tài liệu chính thức (đọc 11/11/2026), CHƯA kiểm bằng lời gọi thật:
 * <ul>
 *   <li>Trang model: https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/</li>
 *   <li>Schema vào: https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/schema-input.json
 *       — {@code audio} (bắt buộc) là chuỗi base64; tuỳ chọn {@code task}, {@code language},
 *       {@code initial_prompt}, {@code vad_filter}…</li>
 *   <li>Schema ra: https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/schema-output.json
 *       — {@code text} (bắt buộc), {@code transcription_info.duration/language},
 *       {@code segments[].avg_logprob}, {@code segments[].words[]} với {@code word/start/end}.</li>
 *   <li>REST API: https://developers.cloudflare.com/workers-ai/get-started/rest-api/ —
 *       {@code POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}},
 *       header {@code Authorization: Bearer <token>}, phản hồi bọc trong
 *       {@code {"result": …, "success": true, "errors": [], "messages": []}}.</li>
 *   <li>Hạn mức: https://developers.cloudflare.com/workers-ai/platform/limits/ — nhóm Automatic
 *       Speech Recognition 720 request/phút.</li>
 * </ul>
 *
 * <p><b>Khác biệt so với dạng Groq</b> (đã san phẳng ở đây):
 * <ul>
 *   <li>Mốc thời gian từng từ nằm TRONG {@code segments[].words[]}, không có {@code words[]} cấp gốc →
 *       gộp lại theo thứ tự segment. Tài liệu không có tham số bật/tắt mốc từng từ; nếu phản hồi không
 *       có {@code words} thì danh sách rỗng ({@code PronunciationScorerService} tự tách từ theo text).</li>
 *   <li>Thời lượng nằm ở {@code transcription_info.duration}, không có {@code duration} cấp gốc;
 *       thiếu thì 0 (sổ STT ghi 0 giây).</li>
 *   <li>Không có {@code words[].probability}; độ tin cậy lấy trung bình {@code segments[].avg_logprob},
 *       thiếu thì mặc định -0.3 như đường chính.</li>
 *   <li>Không gửi {@code temperature}, tên file hay {@code response_format} (schema vào không có).</li>
 *   <li>{@code initial_prompt} mặc định KHÔNG gửi ({@code CF_AI_PROMPT_ENABLED=false}): chưa đo được
 *       Cloudflare có nuốt phần transcript trùng prompt như đã gặp ở nhà cung cấp khác hay không.</li>
 * </ul>
 * Tài liệu không nêu giới hạn kích thước audio cho model này — chưa rõ; ứng dụng đã chặn 8 MB ở tầng trên.
 */
@Component
@Slf4j
public class CloudflareWhisperClient {

    static final String DEFAULT_BASE_URL = "https://api.cloudflare.com/client/v4";
    static final String DEFAULT_MODEL = "@cf/openai/whisper-large-v3-turbo";
    /** Nhãn {@code provider} của metric. */
    public static final String PROVIDER = "cloudflare";
    private static final double DEFAULT_AVG_LOGPROB = -0.3;

    private final String accountId;
    private final String apiToken;
    private final String model;
    private final boolean promptEnabled;
    private final Duration requestTimeout;
    private final String baseUrl;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Autowired
    public CloudflareWhisperClient(
            @Value("${app.ai.stt.cloudflare.account-id:}") String accountId,
            @Value("${app.ai.stt.cloudflare.api-token:}") String apiToken,
            @Value("${app.ai.stt.cloudflare.model:}") String model,
            @Value("${app.ai.stt.cloudflare.timeout-seconds:30}") int timeoutSeconds,
            @Value("${app.ai.stt.cloudflare.prompt-enabled:false}") boolean promptEnabled,
            ObjectMapper objectMapper) {
        this(accountId, apiToken, model, timeoutSeconds, promptEnabled, objectMapper, DEFAULT_BASE_URL);
    }

    /** Cửa cho test: trỏ {@code baseUrl} vào server HTTP giả cục bộ. */
    CloudflareWhisperClient(String accountId, String apiToken, String model, int timeoutSeconds,
                            boolean promptEnabled, ObjectMapper objectMapper, String baseUrl) {
        this.accountId = accountId == null ? "" : accountId.trim();
        this.apiToken = apiToken == null ? "" : apiToken.trim();
        this.model = model == null || model.isBlank() ? DEFAULT_MODEL : model.trim();
        this.promptEnabled = promptEnabled;
        this.requestTimeout = Duration.ofSeconds(timeoutSeconds > 0 ? timeoutSeconds : 30);
        this.baseUrl = baseUrl;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
        log.info("CloudflareWhisperClient initialized — {}", isConfigured()
                ? "model: " + this.model + ", prompt: " + (promptEnabled ? "on" : "off")
                : "TẮT (chưa đặt CF_AI_ACCOUNT_ID/CF_AI_API_TOKEN)");
    }

    /** Có đủ account id + token chưa. False = không bao giờ tạo lời gọi. */
    public boolean isConfigured() {
        return !accountId.isBlank() && !apiToken.isBlank();
    }

    public String getModel() {
        return model;
    }

    /** Bản thường: text + thời lượng. Transcript rỗng → {@code STT_FAILED} như đường chính. */
    public TranscribeResult transcribe(byte[] audioBytes, String language, String prompt) {
        JsonNode result = run(audioBytes, language, prompt);
        String text = result.path("text").asText("");
        if (text.isBlank()) {
            throw new AiServiceException(AiErrorCode.STT_FAILED,
                    "Chưa nghe rõ — bạn nói lại hoặc gõ tay nhé.", null);
        }
        return new TranscribeResult(text.strip(), durationOf(result), model);
    }

    /** Bản verbose: thêm độ tin cậy và mốc thời gian từng từ (gộp từ {@code segments[].words[]}). */
    public VerboseTranscript transcribeVerbose(byte[] audioBytes, String language, String prompt) {
        return toVerbose(run(audioBytes, language, prompt), model);
    }

    /** Chuyển khối {@code result} của Workers AI về {@link VerboseTranscript}. */
    static VerboseTranscript toVerbose(JsonNode result, String model) {
        List<WordTimestamp> words = new ArrayList<>();
        double logprobSum = 0;
        int logprobCount = 0;
        JsonNode segments = result.path("segments");
        if (segments.isArray()) {
            for (JsonNode seg : segments) {
                if (seg.path("avg_logprob").isNumber()) {
                    logprobSum += seg.path("avg_logprob").asDouble();
                    logprobCount++;
                }
                JsonNode segWords = seg.path("words");
                if (!segWords.isArray()) continue;
                for (JsonNode w : segWords) {
                    words.add(new WordTimestamp(
                            w.path("word").asText("").strip(),
                            w.path("start").asDouble(0),
                            w.path("end").asDouble(0)));
                }
            }
        }
        double avgLogprob = logprobCount > 0 ? logprobSum / logprobCount : DEFAULT_AVG_LOGPROB;
        return new VerboseTranscript(result.path("text").asText("").strip(), avgLogprob, words,
                durationOf(result), model);
    }

    private static double durationOf(JsonNode result) {
        return result.path("transcription_info").path("duration").asDouble(0);
    }

    /**
     * Gọi Workers AI và trả khối {@code result}. Mọi lỗi (chưa cấu hình, HTTP khác 200,
     * {@code success=false}, IO/timeout) → {@link AiServiceException} với câu chữ trung tính; 429 mang
     * mã {@code RATE_LIMITED}, còn lại {@code AI_UPSTREAM_UNAVAILABLE}.
     */
    private JsonNode run(byte[] audioBytes, String language, String prompt) {
        if (!isConfigured()) {
            throw new AiServiceException(AiErrorCode.AI_NOT_CONFIGURED,
                    "Tính năng nhận diện giọng nói chưa được bật trên hệ thống.", null);
        }
        try {
            ObjectNode body = objectMapper.createObjectNode();
            body.put("audio", Base64.getEncoder().encodeToString(audioBytes));
            body.put("task", "transcribe");
            body.put("language", language != null && !language.isBlank() ? language : "de");
            if (promptEnabled && prompt != null && !prompt.isBlank()) {
                body.put("initial_prompt", prompt);
            }
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/accounts/" + accountId + "/ai/run/" + model))
                    .header("Authorization", "Bearer " + apiToken)
                    .header("Content-Type", "application/json")
                    .timeout(requestTimeout)
                    .POST(HttpRequest.BodyPublishers.ofByteArray(objectMapper.writeValueAsBytes(body)))
                    .build();
            HttpResponse<String> response =
                    httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            int status = response.statusCode();
            if (status == 429) {
                log.warn("[Whisper-CF] 429 hạn mức");
                throw new AiServiceException(AiErrorCode.RATE_LIMITED,
                        "Hệ thống đang nhận quá nhiều bản ghi âm, vui lòng thử lại sau ít phút.",
                        GroqChatClient.parseRetryAfterSeconds(response.headers().firstValue("retry-after").orElse(null)));
            }
            if (status != 200) {
                if (status == 401 || status == 403) {
                    log.error("[Whisper-CF] LỖI CẤU HÌNH: Cloudflare từ chối xác thực (HTTP {}) — kiểm tra "
                            + "CF_AI_ACCOUNT_ID/CF_AI_API_TOKEN và quyền Workers AI của token.", status);
                } else {
                    log.error("[Whisper-CF] HTTP {}: {}", status, truncate(response.body()));
                }
                throw unavailable(null);
            }
            JsonNode root = objectMapper.readTree(response.body());
            if (root.has("success") && !root.path("success").asBoolean(false)) {
                log.error("[Whisper-CF] success=false: {}", truncate(root.path("errors").toString()));
                throw unavailable(null);
            }
            JsonNode result = root.path("result");
            if (!result.isObject()) {
                log.error("[Whisper-CF] phản hồi không có khối result: {}", truncate(response.body()));
                throw unavailable(null);
            }
            return result;
        } catch (AiServiceException e) {
            throw e;
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new AiServiceException(AiErrorCode.AI_INTERRUPTED,
                    "Yêu cầu nhận diện giọng nói bị gián đoạn, vui lòng thử lại.", null, ie);
        } catch (Exception e) {
            log.error("[Whisper-CF] lỗi truyền tải", e);
            throw unavailable(e);
        }
    }

    private static AiServiceException unavailable(Throwable cause) {
        return new AiServiceException(AiErrorCode.AI_UPSTREAM_UNAVAILABLE,
                "Dịch vụ nhận diện giọng nói tạm thời không khả dụng, vui lòng thử lại sau.", null, cause);
    }

    private static String truncate(String s) {
        if (s == null) return "";
        return s.length() > 300 ? s.substring(0, 300) : s;
    }
}
