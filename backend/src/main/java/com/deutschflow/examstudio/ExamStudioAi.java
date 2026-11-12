package com.deutschflow.examstudio;

import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.examspeaking.scoring.LlmJson;
import com.deutschflow.examstudio.ExamStudioDtos.Fact;
import com.deutschflow.examstudio.ExamStudioDtos.Item;
import com.deutschflow.examstudio.ExamStudioDtos.Source;
import com.deutschflow.examstudio.ExamStudioDtos.Text;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.exception.AiServiceException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * Mọi lời gọi LLM của Xưởng đề. Mỗi hàm một prompt, đầu ra JSON, có ghi sổ token theo admin gọi.
 *
 * <p>Tầng: sinh nội dung = {@link LlmTier#CONTENT}; chấm thang và AI "giỏi" giải đề = {@link LlmTier#GRADING_EXAM};
 * AI "yếu" (đóng vai học viên cấp dưới) = {@link LlmTier#CHAT_FREE} — model nhỏ, rẻ.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ExamStudioAi {

    static final String FEATURE_PREFIX = "EXAM_STUDIO_";

    private final OpenAiChatClient chatClient;
    private final LlmTierResolver tiers;
    private final AiUsageLedgerService ledger;
    private final ObjectMapper mapper;

    /** Vai của một lượt gọi trong Xưởng đề: viết (rút dữ kiện, viết bài, ra câu hỏi) hay chấm (thang, giải thử, đối chiếu). */
    enum Role { WRITER, JUDGE }

    /**
     * Model RIÊNG của Xưởng đề, tách khỏi các tầng dùng chung với luyện nói và chấm thi. Chọn sau phép so
     * 9 model trên Fireworks ngày 11/11/2026 (cùng dữ kiện, cùng prompt production): Kimi K3 viết tự nhiên và
     * đúng tầm B1 nhất; DeepSeek V4.1 Flash khác họ với model viết nên dùng để chấm. Để trống một khoá thì vai
     * đó quay về tầng cũ ({@code writer-tier} cho viết, tầng của lời gọi cho chấm).
     */
    @org.springframework.beans.factory.annotation.Value("${app.exam-studio.writer-model:}")
    private String writerModel = "";
    @org.springframework.beans.factory.annotation.Value("${app.exam-studio.judge-model:}")
    private String judgeModel = "";
    /**
     * Sàn hạn mức đầu ra khi dùng model riêng. Các model này "nghĩ" trước khi viết và phần nghĩ tính chung vào
     * max_tokens: với 3 500–4 500 token của prompt cũ, cả 8 model thử đều bị cắt giữa chừng.
     */
    @org.springframework.beans.factory.annotation.Value("${app.exam-studio.min-output-tokens:16000}")
    private int minOutputTokens = 16_000;
    @org.springframework.beans.factory.annotation.Value("${app.exam-studio.writer-tier:GRADING_EXAM}")
    private LlmTier writerTier = LlmTier.GRADING_EXAM;

    private static boolean set(String v) {
        return v != null && !v.isBlank();
    }

    /** Vai mặc định theo tầng mà lời gọi khai: CONTENT = viết, GRADING_EXAM = chấm; tầng khác giữ nguyên đường cũ. */
    private static Role roleOf(LlmTier tier) {
        return tier == LlmTier.CONTENT ? Role.WRITER : tier == LlmTier.GRADING_EXAM ? Role.JUDGE : null;
    }

    /** Thông số gọi cho model riêng: giữ endpoint và khoá của tầng, đổi model, KHÔNG gửi reasoning_effort (knob của gpt-oss). */
    private com.deutschflow.ai.tier.TierSpec dedicated(LlmTier tier, String model) {
        com.deutschflow.ai.tier.TierSpec base = tiers.spec(tier);
        return new com.deutschflow.ai.tier.TierSpec(base.tier(), model, base.baseUrl(), base.apiKey(), base.providerOrder(),
                base.requireParameters(), base.sort(), base.quantizations(), null, base.sessionSticky(),
                base.includeUsage());
    }

    // ── Kênh tạo đề ─────────────────────────────────────────────────────────────────────────
    // Hai kênh TÁCH RIÊNG, admin chọn bằng nút trên màn Xưởng đề (owner chốt 11/11/2026):
    //   FIREWORKS — tài khoản Fireworks của hệ thống (Kimi K3 viết, DeepSeek V4.1 Flash chấm);
    //   ROUTER    — cổng 9Router của owner (endpoint kiểu OpenAI), sau đó là API Claude / Grok owner tự trả tiền.
    // Không kênh nào tự chuyển sang kênh kia: kênh đang chọn lỗi thì báo lỗi, admin tự đổi kênh rồi bấm lại.

    public enum Channel {
        FIREWORKS, ROUTER;

        /** Rỗng ⇒ FIREWORKS; tên lạ ⇒ lỗi rõ ràng (không lặng lẽ rơi về kênh mặc định). */
        public static Channel of(Object v) {
            if (v == null || String.valueOf(v).isBlank()) return FIREWORKS;
            try {
                return valueOf(String.valueOf(v).trim().toUpperCase(java.util.Locale.ROOT));
            } catch (IllegalArgumentException e) {
                throw new com.deutschflow.common.exception.BadRequestException("Kênh tạo đề không hợp lệ: " + v);
            }
        }
    }

    /** Kênh của thao tác đang chạy trên luồng này: controller đặt khi nhận yêu cầu, job nền đặt lại khi chạy. */
    private static final ThreadLocal<Channel> CURRENT = new ThreadLocal<>();

    public static void useChannel(Channel c) {
        CURRENT.set(c == null ? Channel.FIREWORKS : c);
    }

    public static void clearChannel() {
        CURRENT.remove();
    }

    public static Channel currentChannel() {
        Channel c = CURRENT.get();
        return c == null ? Channel.FIREWORKS : c;
    }

    @org.springframework.beans.factory.annotation.Value("${app.exam-studio.router.base-url:}")
    private String routerBaseUrl = "";
    @org.springframework.beans.factory.annotation.Value("${app.exam-studio.router.api-key:}")
    private String routerApiKey = "";
    @org.springframework.beans.factory.annotation.Value("${app.exam-studio.router.writer-model:}")
    private String routerWriterModel = "";
    /** Để trống ⇒ dùng luôn model viết để chấm. */
    @org.springframework.beans.factory.annotation.Value("${app.exam-studio.router.judge-model:}")
    private String routerJudgeModel = "";
    /**
     * Có gửi {@code temperature} và {@code response_format} cho kênh 9Router không. Mặc định KHÔNG: các model
     * Claude mới từ chối temperature khác mặc định, và cổng trung gian không phải lúc nào cũng dịch được
     * response_format. Prompt đã yêu cầu "chỉ trả JSON" và phần đọc kết quả tự bóc ```json.
     */
    @org.springframework.beans.factory.annotation.Value("${app.exam-studio.router.send-temperature:false}")
    private boolean routerSendTemperature = false;
    @org.springframework.beans.factory.annotation.Value("${app.exam-studio.router.json-mode:false}")
    private boolean routerJsonMode = false;

    /** Một đích gọi: tên ghi sổ, địa chỉ đầy đủ, khoá, model và cách dựng request. */
    record Endpoint(String name, String url, String key, String model, boolean sendTemperature, boolean jsonMode) {}

    /** Thông tin một kênh cho màn hình (không bao giờ kèm khoá hay địa chỉ). */
    public record ChannelInfo(String id, boolean configured, String writerModel, String judgeModel) {}

    /** Nhận cả địa chỉ gốc kiểu ".../v1" (cách các cổng OpenAI-compatible hay ghi) lẫn địa chỉ đầy đủ. */
    static String chatUrl(String url) {
        if (url == null) return null;
        String u = url.trim();
        while (u.endsWith("/")) u = u.substring(0, u.length() - 1);
        return u.endsWith("/v1") ? u + "/chat/completions" : u;
    }

    boolean routerConfigured() {
        return set(routerBaseUrl) && set(routerApiKey) && set(routerWriterModel);
    }

    public List<ChannelInfo> channels() {
        String rj = set(routerJudgeModel) ? routerJudgeModel.trim() : routerWriterModel.trim();
        return List.of(
                new ChannelInfo(Channel.FIREWORKS.name(), true,
                        set(writerModel) ? writerModel : tiers.spec(writerTier).model(),
                        set(judgeModel) ? judgeModel : tiers.spec(LlmTier.GRADING_EXAM).model()),
                new ChannelInfo(Channel.ROUTER.name(), routerConfigured(),
                        routerConfigured() ? routerWriterModel.trim() : null, routerConfigured() ? rj : null));
    }

    /** Kênh admin yêu cầu; kênh chưa cấu hình thì từ chối ngay ở request, không đợi tới job nền. */
    public Channel requireChannel(String requested) {
        Channel c = Channel.of(requested);
        if (c == Channel.ROUTER && !routerConfigured()) {
            throw new com.deutschflow.common.exception.BadRequestException(
                    "Kênh 9Router chưa được cấu hình trên máy chủ (địa chỉ, khoá và model viết).");
        }
        return c;
    }

    private JsonNode viaRouter(Role role, long userId, String op, String system, String user, double temperature,
                               int maxTokens) {
        if (!routerConfigured()) throw new AiServiceException("Kênh 9Router chưa được cấu hình trên máy chủ.");
        String model = role == Role.JUDGE && set(routerJudgeModel) ? routerJudgeModel : routerWriterModel;
        Endpoint e = new Endpoint("9ROUTER", chatUrl(routerBaseUrl), routerApiKey, model.trim(), routerSendTemperature,
                routerJsonMode);
        return withTruncationRetry(userId, op, e, system, user, temperature, Math.max(maxTokens, minOutputTokens));
    }

    JsonNode call(long userId, String op, LlmTier tier, String system, String user, double temperature,
                  int maxTokens) {
        Role role = roleOf(tier);
        // Kênh 9Router: MỌI lượt gọi của thao tác đi qua 9Router, kể cả lượt không thuộc vai viết/chấm.
        if (currentChannel() == Channel.ROUTER) {
            return viaRouter(role == null ? Role.JUDGE : role, userId, op, system, user, temperature, maxTokens);
        }
        String model = role == Role.WRITER ? writerModel : role == Role.JUDGE ? judgeModel : null;
        if (set(model)) {
            return direct(userId, op, dedicated(tier, model), system, user, temperature,
                    Math.max(maxTokens, minOutputTokens));
        }
        return blocking(userId, op, tiers.spec(tier), system, user, temperature, maxTokens);
    }

    /** Lượt VIẾT của Teil lấy từ nguồn báo và lượt đối chiếu dữ kiện: luôn đi đường stream (đầu ra dài). */
    JsonNode callAs(Role role, long userId, String op, String system, String user, double temperature, int maxTokens) {
        if (currentChannel() == Channel.ROUTER) {
            return viaRouter(role, userId, op, system, user, temperature, maxTokens);
        }
        String model = role == Role.WRITER ? writerModel : judgeModel;
        LlmTier tier = role == Role.WRITER ? writerTier : LlmTier.GRADING_EXAM;
        if (set(model)) {
            return direct(userId, op, dedicated(tier, model), system, user, temperature,
                    Math.max(maxTokens, minOutputTokens));
        }
        return stream(userId, op, tiers.spec(tier), system, user, temperature, maxTokens);
    }

    @org.springframework.beans.factory.annotation.Value("${app.ai.groq.api-key:}")
    private String defaultApiKey = "";
    @org.springframework.beans.factory.annotation.Value("${app.ai.groq.base-url:}")
    private String defaultBaseUrl = "";
    /** Trần thời gian cho MỘT lượt gọi model riêng. Kimi K3 mất ~145 giây cho 5 câu trong phép so 11/11/2026. */
    @org.springframework.beans.factory.annotation.Value("${app.exam-studio.call-timeout-seconds:300}")
    private int callTimeoutSeconds = 300;

    private static final java.net.http.HttpClient HTTP = java.net.http.HttpClient.newBuilder()
            .connectTimeout(java.time.Duration.ofSeconds(10)).build();

    /** Có đang dùng model riêng (đường gọi riêng, chịu được lượt gọi dài) cho vai viết không. */
    boolean dedicatedWriter() {
        return set(writerModel);
    }

    /**
     * Số câu a/b/c xin trong một lượt gọi. Kênh 9Router đi qua đường hầm tới máy của owner — lượt gọi quá dài dễ
     * bị đường hầm cắt, nên xin hai câu một lượt; kênh Fireworks đường riêng xin ba; đường cũ giữ hai.
     */
    int itemsPerCall() {
        return currentChannel() == Channel.ROUTER ? 2 : dedicatedWriter() ? 3 : 2;
    }

    /**
     * Đường gọi RIÊNG của Xưởng đề cho model riêng: gọi thẳng endpoint, chờ tới {@code call-timeout-seconds}.
     *
     * <p>KHÔNG đi qua {@code GroqChatClient}: client đó phục vụ hội thoại thời gian thực nên có trần 15 giây
     * (blocking) / 90 giây (stream) và dùng CHUNG semaphore + circuit breaker "groqChat" với luyện nói. Sự cố
     * 11/11/2026: ba lượt Kimi K3 vượt 90 giây làm ngắt mạch đó, tức việc soạn đề của admin có thể làm rớt hội
     * thoại của học viên. Soạn đề là việc nền, chậm cũng được, nhưng không được đụng tới đường của học viên.
     */
    /** Trần hạn mức đầu ra khi thử lại một lượt bị cắt. */
    static final int MAX_OUTPUT_TOKENS = 48_000;

    /** Lượt bị cắt vì model "nghĩ" hết hạn mức: báo riêng để thử lại với hạn mức lớn hơn. */
    static final class TruncatedException extends AiServiceException {
        TruncatedException() {
            super("AI bị cắt giữa chừng vì hết hạn mức đầu ra, hãy thử lại.");
        }
    }

    /**
     * Gọi model riêng; lượt nào bị cắt vì hết hạn mức đầu ra thì thử lại MỘT lần với hạn mức gấp đôi. Chạy thật
     * 11/11/2026: DeepSeek V4.1 Flash dùng hết 16 000 token cho phần "nghĩ" ở một lượt giải thử ngắn.
     */
    private JsonNode direct(long userId, String op, com.deutschflow.ai.tier.TierSpec spec, String system, String user,
                            double temperature, int maxTokens) {
        Endpoint e = new Endpoint("FIREWORKS", set(spec.baseUrl()) ? spec.baseUrl() : defaultBaseUrl,
                set(spec.apiKey()) ? spec.apiKey() : defaultApiKey, spec.model(), true, true);
        return withTruncationRetry(userId, op, e, system, user, temperature, maxTokens);
    }

    private JsonNode withTruncationRetry(long userId, String op, Endpoint e, String system, String user,
                                         double temperature, int maxTokens) {
        try {
            return directOnce(userId, op, e, system, user, temperature, maxTokens);
        } catch (TruncatedException t) {
            int more = Math.min(MAX_OUTPUT_TOKENS, maxTokens * 2);
            log.warn("[ExamStudio] {} model {} bị cắt ở {} token — thử lại với {}", op, e.model(), maxTokens, more);
            if (more <= maxTokens) throw t;
            return directOnce(userId, op, e, system, user, temperature, more);
        }
    }

    /**
     * Thân trả lời của một lượt chat. Bình thường là một JSON {@code chat.completion}. Một số kết nối của cổng trung
     * gian (9Router với kết nối Claude, thấy trên production 12/11/2026) trả dạng dòng sự kiện {@code data: {...}}
     * dù không xin stream — khi đó ghép các mảnh {@code delta.content} lại thành một {@code chat.completion}.
     */
    static JsonNode parseCompletion(ObjectMapper mapper, String body) throws java.io.IOException {
        String trimmed = body == null ? "" : body.stripLeading();
        if (!trimmed.startsWith("data:")) return mapper.readTree(trimmed);
        StringBuilder content = new StringBuilder();
        String finish = null;
        JsonNode usage = null;
        for (String line : trimmed.split("\\r?\\n")) {
            if (!line.startsWith("data:")) continue;
            String data = line.substring(5).trim();
            if (data.isEmpty() || data.equals("[DONE]")) continue;
            JsonNode chunk;
            try {
                chunk = mapper.readTree(data);
            } catch (java.io.IOException e) {
                continue; // mảnh hỏng: bỏ qua, các mảnh khác vẫn ghép được
            }
            JsonNode choice = chunk.path("choices").path(0);
            JsonNode piece = choice.path("delta").path("content");
            if (piece.isTextual()) content.append(piece.asText());
            if (choice.path("message").path("content").isTextual()) content.append(choice.path("message").path("content").asText());
            if (choice.path("finish_reason").isTextual()) finish = choice.path("finish_reason").asText();
            if (chunk.path("usage").isObject()) usage = chunk.path("usage");
        }
        com.fasterxml.jackson.databind.node.ObjectNode out = mapper.createObjectNode();
        com.fasterxml.jackson.databind.node.ObjectNode choice = out.putArray("choices").addObject();
        choice.putObject("message").put("role", "assistant").put("content", content.toString());
        if (finish != null) choice.put("finish_reason", finish);
        if (usage != null) out.set("usage", usage);
        return out;
    }

    private JsonNode directOnce(long userId, String op, Endpoint spec, String system, String user,
                                double temperature, int maxTokens) {
        String url = spec.url();
        String key = spec.key();
        if (!set(url) || !set(key)) throw new AiServiceException("Chưa cấu hình endpoint AI cho Xưởng đề.");
        com.fasterxml.jackson.databind.node.ObjectNode body = mapper.createObjectNode();
        body.put("model", spec.model());
        com.fasterxml.jackson.databind.node.ArrayNode msgs = body.putArray("messages");
        msgs.addObject().put("role", "system").put("content", system);
        msgs.addObject().put("role", "user").put("content", user);
        if (spec.sendTemperature()) body.put("temperature", temperature);
        body.put("max_tokens", maxTokens);
        body.put("stream", false);
        if (spec.jsonMode()) body.putObject("response_format").put("type", "json_object");

        JsonNode res = null;
        String failure = null;
        for (int attempt = 1; attempt <= 2 && res == null; attempt++) {
            try {
                java.net.http.HttpRequest req = java.net.http.HttpRequest.newBuilder(java.net.URI.create(url))
                        .timeout(java.time.Duration.ofSeconds(callTimeoutSeconds))
                        .header("Authorization", "Bearer " + key)
                        .header("Content-Type", "application/json")
                        .POST(java.net.http.HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body),
                                java.nio.charset.StandardCharsets.UTF_8))
                        .build();
                java.net.http.HttpResponse<String> http = HTTP.send(req,
                        java.net.http.HttpResponse.BodyHandlers.ofString(java.nio.charset.StandardCharsets.UTF_8));
                int code = http.statusCode();
                if (code == 200) {
                    res = parseCompletion(mapper, http.body());
                } else {
                    failure = "HTTP " + code;
                    log.warn("[ExamStudio] {} model {} trả {} (lượt {})", op, spec.model(), code, attempt);
                    // Lỗi phía mình (400/401/404) thử lại cũng vậy; quá tải hay lỗi máy chủ thì thử thêm một lần.
                    if (code != 429 && code < 500) break;
                    Thread.sleep(3_000L);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new AiServiceException("Yêu cầu AI bị gián đoạn, vui lòng thử lại.", e);
            } catch (java.net.http.HttpTimeoutException e) {
                failure = "quá " + callTimeoutSeconds + " giây";
                log.warn("[ExamStudio] {} model {} quá {} giây", op, spec.model(), callTimeoutSeconds);
                break;
            } catch (Exception e) {
                failure = e.getClass().getSimpleName();
                log.warn("[ExamStudio] {} model {} lỗi kết nối (lượt {}): {}", op, spec.model(), attempt, e.toString());
            }
        }
        if (res == null) {
            throw new AiServiceException("Model soạn đề không trả lời (" + failure + "), vui lòng thử lại.");
        }
        JsonNode choice = res.path("choices").path(0);
        String content = choice.path("message").path("content").asText("");
        if ("length".equals(choice.path("finish_reason").asText())) {
            throw new TruncatedException();
        }
        if (content.isBlank()) throw new AiServiceException("AI không trả về nội dung, vui lòng thử lại.");
        try {
            JsonNode u = res.path("usage");
            com.deutschflow.speaking.ai.TokenUsage usage = new com.deutschflow.speaking.ai.TokenUsage(
                    u.path("prompt_tokens").asInt(0), u.path("completion_tokens").asInt(0),
                    u.path("total_tokens").asInt(0), false,
                    u.path("prompt_tokens_details").path("cached_tokens").asInt(0));
            ledger.record(userId, spec.name(), spec.model(), usage, FEATURE_PREFIX + op, null, null);
        } catch (Exception e) {
            log.warn("[ExamStudio] Không ghi được sổ token: {}", e.getMessage());
        }
        return LlmJson.parse(mapper, content)
                .orElseThrow(() -> new AiServiceException("AI trả JSON hỏng, hãy thử lại."));
    }

    private JsonNode blocking(long userId, String op, com.deutschflow.ai.tier.TierSpec spec, String system, String user,
                              double temperature, int maxTokens) {
        AiChatCompletionResult res;
        try {
            res = chatClient.chatCompletionForTier(
                    List.of(new ChatMessage("system", system), new ChatMessage("user", user)),
                    spec, temperature, maxTokens, true);
        } catch (AiServiceException e) {
            throw e;
        } catch (Exception e) {
            throw new AiServiceException("Dịch vụ AI tạm thời không khả dụng, vui lòng thử lại.", e);
        }
        if (res == null || res.content() == null || res.content().isBlank()) {
            throw new AiServiceException("AI không trả về nội dung, vui lòng thử lại.");
        }
        try {
            ledger.record(userId, res.provider(), res.model(), res.usage(), FEATURE_PREFIX + op, null, null);
        } catch (Exception e) {
            log.warn("[ExamStudio] Không ghi được sổ token: {}", e.getMessage());
        }
        return LlmJson.parse(mapper, res.content())
                .orElseThrow(() -> new AiServiceException("AI trả JSON hỏng, hãy thử lại."));
    }

    /**
     * Đường stream, gom lại thành một chuỗi. Đường gọi thường của client có trần đọc 15 giây cho cả câu trả lời —
     * bài 300+ từ hay model có phần "nghĩ" đều vượt trần đó (sự cố ngay sau deploy 11/11/2026: "Read timed out").
     * Đường stream chỉ đặt trần cho khoảng lặng GIỮA các mẩu.
     */
    private JsonNode stream(long userId, String op, com.deutschflow.ai.tier.TierSpec spec, String system, String user,
                            double temperature, int maxTokens) {
        java.util.concurrent.atomic.AtomicReference<AiChatCompletionResult> done =
                new java.util.concurrent.atomic.AtomicReference<>();
        StringBuilder streamed = new StringBuilder();
        boolean ok;
        try {
            ok = chatClient.chatCompletionStreamForTier(
                    List.of(new ChatMessage("system", system), new ChatMessage("user", user)),
                    spec, temperature, maxTokens, streamed::append, done::set,
                    new java.util.concurrent.atomic.AtomicBoolean(false));
        } catch (AiServiceException e) {
            throw e;
        } catch (Exception e) {
            throw new AiServiceException("Dịch vụ AI tạm thời không khả dụng, vui lòng thử lại.", e);
        }
        AiChatCompletionResult res = done.get();
        String content = res != null && res.content() != null && !res.content().isBlank()
                ? res.content() : streamed.toString();
        if (!ok || content.isBlank()) {
            throw new AiServiceException("AI không trả về nội dung, vui lòng thử lại.");
        }
        if (res != null) {
            try {
                ledger.record(userId, res.provider(), res.model(), res.usage(), FEATURE_PREFIX + op, null, null);
            } catch (Exception e) {
                log.warn("[ExamStudio] Không ghi được sổ token: {}", e.getMessage());
            }
        }
        return LlmJson.parse(mapper, content)
                .orElseThrow(() -> new AiServiceException("AI trả JSON hỏng, hãy thử lại."));
    }

    // ── 1. Rút dữ kiện từ bài nguồn ─────────────────────────────────────────────────────────

    static final String FACTS_SYSTEM = """
            Du bereitest Material für eine Deutschprüfung (telc) vor. Du bekommst einen Zeitungs- oder
            Fachartikel. Aufgabe:
            1. Extrahiere bis zu 15 überprüfbare FAKTEN, die sich für einen Lesetext auf dem angegebenen
               Niveau eignen. Formuliere jeden Fakt mit EIGENEN Worten neu (max. 25 Wörter), übernimm keine
               Sätze aus dem Artikel. Zahlen immer mit Jahr bzw. Zeitraum.
               Schreibe in Alltagssprache des angegebenen Niveaus: ersetze Fachbegriffe und Fremdwörter durch
               eine einfache Umschreibung (z. B. statt "Coping-Strategie": "Art, mit Stress umzugehen"; statt
               "Verdrängung": "Probleme nicht wahrhaben wollen"; statt "erwerbsfähiges Alter": "Arbeitsalter").
               Verändere die AUSSAGEKRAFT nicht: Ein Zusammenhang ("hängt zusammen mit", "ist verbunden mit",
               "assoziiert") bleibt ein Zusammenhang und wird NIE zu Ursache und Wirkung ("führt zu",
               "erhöht", "senkt"). Ordne jede Aussage genau der Gruppe zu, für die der Artikel sie macht.
            2. Prüfe die Neutralität des Themas. Erlaubt: Arbeit, Wohnen, Gesundheit, Bildung, Verkehr,
               Reisen, Einkaufen, Technik im Alltag, Sport, Essen und Trinken. NICHT erlaubt: Politik,
               Migration, Krieg, Religion, umstrittene Wirtschaftsthemen. Bei Verstoß: neutral=false und
               Begründung auf Vietnamesisch.
            3. Falls bereits Fakten aus anderen Quellen gegeben sind: gib für jeden neuen Fakt "sameAs" mit der
               ID des bestehenden Fakts an, wenn er dasselbe aussagt (sonst null), und liste unter "confirms"
               die IDs bestehender Fakten, die dieser Artikel bestätigt.
            Antworte NUR mit JSON:
            {"title": "...|null", "author": "...|null", "publisher": "...|null", "publishedAt": "...|null",
             "neutral": true, "neutralityReasonVi": "...|null",
             "facts": [{"text": "...", "figure": "...|null", "year": "...|null", "paragraph": 1, "sameAs": null}],
             "confirms": []}
            """;

    static final int FACTS_MAX_CHARS = 36_000;

    JsonNode extractFacts(long userId, String level, String theme, String articleText, List<Fact> existing) {
        // 36 000 ký tự ≈ một bài khoa học 8–10 trang: với trần 14 000 cũ, phần kết quả của bài tải từ tệp
        // PDF bị cắt mất, AI chỉ còn đọc được tóm tắt và phương pháp.
        String clipped = articleText.length() > FACTS_MAX_CHARS ? articleText.substring(0, FACTS_MAX_CHARS) : articleText;
        String existingTxt = existing.isEmpty() ? "(keine)" : existing.stream()
                .map(f -> f.id() + ": " + f.text())
                .collect(Collectors.joining("\n"));
        String user = "Niveau: " + level + "\nThema: " + (theme == null ? "frei" : theme)
                + "\n\nBestehende Fakten:\n" + existingTxt + "\n\nArtikel (Absätze durch Leerzeilen getrennt):\n"
                + clipped;
        return callAs(Role.WRITER, userId, "FACTS", FACTS_SYSTEM, user, 0.2, 3_000);
    }

    // ── 2. Viết bài đọc từ dữ kiện ──────────────────────────────────────────────────────────

    static final String TEXT_SYSTEM = """
            Du schreibst einen NEUEN Lesetext für telc Deutsch %s, Leseverstehen Teil 2 (Zeitungsartikel).
            Regeln:
            - Benutze NUR die gegebenen Fakten; erfinde keine Zahlen, Namen oder Studien.
            - Schreibe komplett mit eigenen Worten; übernimm keine Formulierung einer Quelle.
            - Länge des Haupttextes: MINDESTENS %d und höchstens %d Wörter in 4–6 Absätzen. Jeder Absatz ist
              zusammenhängender Fließtext mit 4–6 Sätzen (etwa 55–90 Wörter) und behandelt EIN Teilthema; fasse
              verwandte Fakten im selben Absatz zusammen und verbinde die Sätze (deshalb, außerdem, dagegen …).
              NICHT für jeden Fakt einen eigenen Absatz beginnen. Kurze klare Sätze, Wortschatz %s. Ein kürzerer Text ist unbrauchbar. Reichen die Fakten nicht für
              die Länge, erkläre sie ausführlicher (Beispiel aus dem Alltag, Bedeutung für Betroffene), aber
              erfinde keine neuen Zahlen, Namen oder Ergebnisse.
            - Aussagekraft der Fakten beibehalten: Ein Zusammenhang wird nie zu Ursache und Wirkung. Jede
              Aussage bleibt bei der Gruppe, für die der Fakt sie macht. Pronomen und "diese/dieser" müssen
              sich eindeutig auf den richtigen Satz beziehen.
            - Zahlen immer mit Jahr. Neutraler Ton, keine Werbung, keine Politik.
            - Stil: Zeitungsartikel für ein breites Publikum (wie in einer Tageszeitung), KEIN Forschungsbericht.
              Beginne mit etwas aus dem Alltag der Leser; nenne die Studie nur kurz als Quelle der Zahlen.
            - Keine Fachbegriffe und keine englischen Fremdwörter ("Coping", "Public Health", "proaktiv" …):
              umschreibe sie mit einfachen Wörtern des Niveaus. Stehen solche Wörter in den Fakten, übersetze
              sie in Alltagssprache.
            - Überschrift (titleDe) und Vorspann (vorspannDe, 1–2 Sätze). Reiner Text, KEIN Markdown: keine
              Sternchen für Fettdruck, keine Rauten.
            - Ein Wort, das über dem Niveau liegt und sich nicht vermeiden lässt, bekommt direkt DAHINTER ein
              Sternchen (Beispiel: "vorbeugend*") und eine einfache Erklärung im Glossar. Höchstens 4 solche
              Wörter; jedes Wort, um das sich eine Aufgabe drehen könnte, muss verständlich sein.
            - Der Text muss genug Informationen für 5 Aufgaben bieten (verschiedene Absätze, Zahlen, Meinungen).
            Antworte NUR mit JSON:
            {"titleDe": "...", "vorspannDe": "...", "paragraphs": ["...", "..."],
             "glossary": [{"term": "...", "explanationDe": "..."}], "usedFactIds": ["f1", "..."]}
            """;

    static final String TEXT_T1_SYSTEM = """
            Du schreibst FÜNF NEUE kurze Texte für telc Deutsch %s, Leseverstehen Teil 1 (Kurzmeldungen aus
            Zeitung oder Internet, jeweils ein eigenes Ereignis oder Angebot).
            Regeln:
            - Benutze NUR die gegebenen Fakten; erfinde keine Zahlen, Namen oder Studien. Fehlen Fakten, ergänze
              nur harmloses Alltagswissen ohne Zahlen.
            - Komplett eigene Worte, keine Formulierung einer Quelle.
            - Jeder Text %d–%d Wörter, Wortschatz %s, klare Sätze, ein eindeutiges Hauptthema pro Text.
            - Die fünf Texte unterscheiden sich, bleiben aber im selben Themenfeld (damit verwechselbare
              Überschriften möglich sind).
            - Keine Überschriften schreiben.
            Antworte NUR mit JSON: {"texts": [{"text": "...", "usedFactIds": ["s1f1"]}]}
            """;

    JsonNode writeText(long userId, TeilSpec spec, String theme, List<Fact> facts, String note) {
        String system = spec.headlines()
                ? TEXT_T1_SYSTEM.formatted(spec.cefrLevel(), spec.minWords(), spec.maxWords(), spec.cefrLevel())
                : TEXT_SYSTEM.formatted(spec.cefrLevel(), spec.minWords(), spec.maxWords(), spec.cefrLevel());
        String user = "Thema: " + (theme == null ? "frei" : theme) + "\nFakten:\n" + facts.stream()
                .map(f -> f.id() + ": " + f.text()
                        + (f.figure() == null ? "" : " [Zahl: " + f.figure() + "]")
                        + (f.year() == null ? "" : " [Jahr: " + f.year() + "]"))
                .collect(Collectors.joining("\n"))
                + (note == null || note.isBlank() ? "" : "\n\nHinweis der Redaktion: " + note);
        return callAs(Role.WRITER, userId, "TEXT", system, user, 0.6, 3_500);
    }

    static final String REWRITE_SYSTEM = """
            Du überarbeitest einen Abschnitt eines Lesetextes für telc Deutsch %s.
            Modus REWRITE: gleicher Inhalt, andere Formulierung. Modus SIMPLIFY: einfacher, kürzere Sätze,
            Wortschatz %s. Keine neuen Fakten. Antworte NUR mit JSON: {"replacement": "..."}
            """;

    JsonNode rewrite(long userId, TeilSpec spec, Text text, String selection, String mode, String note) {
        String system = REWRITE_SYSTEM.formatted(spec.cefrLevel(), spec.cefrLevel());
        String user = "Modus: " + mode + "\nGanzer Text:\n" + text.context() + "\n\nAbschnitt:\n" + selection
                + (note == null || note.isBlank() ? "" : "\n\nHinweis: " + note);
        return call(userId, "TEXT", LlmTier.CONTENT, system, user, 0.5, 1_200);
    }

    // ── 3. Ra câu hỏi theo bậc ──────────────────────────────────────────────────────────────

    static final String ITEMS_SYSTEM = """
            Du erstellst Aufgaben für telc Deutsch %s, Leseverstehen Teil 2.

            FORM (wie im Original): Jede Aufgabe ist ein SATZANFANG ("question"), der mit " …" endet, und drei
            SATZENDEN ("options"), die den Satz grammatisch korrekt fortsetzen; genau EIN Ende ist laut Text
            richtig. Keine Fragesätze, kein Fragezeichen, kein "Welche Aussage …".
            Beispiel: "question": "Am Wochenende …", Enden: "schlafen viele Erwachsene länger als an
            Arbeitstagen." / "schlafen die meisten Menschen kürzer." / "arbeiten immer mehr Menschen."
            Die Reihenfolge der Aufgaben soll NICHT der Reihenfolge des Textes folgen.

            SCHWIERIGKEIT: Alles bleibt Niveau %s; nur die Fragetechnik ändert sich. Jede Stufe hat einen
            festen BAUPLAN. Halte ihn genau ein:
            - EASY: Beleg in EINEM Satz. Die Lösung benutzt die Wörter dieses Satzes. Beide falschen Enden
              nennen etwas, das im Text gar nicht vorkommt.
            - MEDIUM: Beleg in einem Absatz (2–3 Sätze). Die Lösung sagt dasselbe mit ANDEREN Wörtern
              (Synonym, andere Satzstruktur). Ein falsches Ende nimmt ein echtes Detail aus dem Text und
              ordnet es falsch zu.
            - HARD: Die Lösung steht in keinem Satz wörtlich, sie muss aus 2–3 Sätzen erschlossen werden.
              BEIDE falschen Enden benutzen echte Details aus dem Text mit einer feinen Falle (Ursache und
              Wirkung vertauscht, Zukunft statt Gegenwart, Negation, nur/alle, Zahl der falschen Gruppe
              zugeordnet).
            - EXPERT: Die Lösung verbindet Informationen aus ZWEI VERSCHIEDENEN Absätzen; kein einzelner
              Absatz reicht aus. Die Lösung benutzt kaum Wörter aus dem Text. Ein falsches Ende ist
              "halb richtig": die erste Hälfte stimmt mit dem Text, die zweite nicht.
            Niemals Schwierigkeit durch Wörter über dem Niveau oder durch unwichtige Details erzeugen. Gibt der
            Text eine verlangte Stufe nicht her, komme ihr so nah wie möglich.

            QUALITÄT (gilt für jede Stufe):
            - Satzanfang und Satzenden benutzen nur Wörter des Niveaus oder Wörter, die im Text stehen. Keine
              Prüfungs- oder Fachsprache ("interpretieren", "ableiten", "Stichprobe", "im Kontext von").
            - Jede Zahl, Menge oder Gruppe im Satzanfang muss genau dem Text entsprechen (steht im Text
              "20 Prozent", dann nicht "ein Viertel").
            - Der vollständige Satz aus Satzanfang + richtiger Lösung muss eine Aussage sein, die der Text belegt.
            - Jedes falsche Ende muss für jemanden, der den Text NICHT gelesen hat, genauso glaubwürdig klingen
              wie die Lösung. Keine Übertreibungen ("alle", "nur", "allein", "niemand"), die man ohne Text als
              falsch erkennt, außer die Stufe verlangt genau diese Falle und der Text nennt die Gruppe.
            - Die drei Enden sind etwa gleich lang und gleich gebaut.

            ARBEITSWEISE: Plane jede Aufgabe ZUERST im Feld "plan", dann schreibe sie:
            - "plan": {"paragraphs": [Nummern der Absätze, in denen der Beleg steht],
                       "traps": [Fallenregel je falschem Ende]}
            - "options": genau 3 Objekte {"text", "correct": true|false, "trap": Fallenregel auf Deutsch
              oder null}; genau eines correct.
            - "evidence": WÖRTLICHE, vollständige Sätze aus dem TEXT (nicht aus der Quelle), die die Lösung
              belegen — genau die Sätze aus den Absätzen in "plan.paragraphs", unverändert kopiert.
            - "explanationVi": Erklärung auf VIETNAMESISCH, warum die Lösung richtig ist und warum jede
              falsche Option falsch ist, mit Bezug auf die Textstelle. Bezeichne Optionen NUR mit {1}, {2},
              {3} (= Reihenfolge in "options"), niemals mit a/b/c.
            Antworte NUR mit JSON: {"items": [{"slot": 0, "plan": {"paragraphs": [2], "traps": ["..."]},
              "question": "... …", "options": [...], "evidence": "...", "explanationVi": "..."}]}
            """;

    static final String ITEMS_T1_SYSTEM = """
            Du erstellst Überschriften für telc Deutsch %s, Leseverstehen Teil 1: fünf Texte, zehn Überschriften
            (a–j). Für jeden angegebenen Text schreibst du GENAU ZWEI Überschriften:
            - "headline": passt am besten zum Text (Hauptaussage, nicht nur ein Detail);
            - "nearHeadline": eine verwechselbare Falle, die NICHT passt (übertreibt "die meisten"/"alle",
              behauptet, was der Text verneint, vertauscht Rollen oder Ursache und Wirkung, greift ein
              Schlüsselwort auf, verfehlt aber die Aussage). Sie darf auch zu keinem anderen Text passen.
            Schwierigkeit pro Text (Niveau bleibt %s), je 0–2 Punkte:
            - phrasing: 0 = Überschrift wiederholt Schlüsselwörter; 1 = umformuliert; 2 = Hauptaussage erschließen.
            - evidence: 0 = ein Satz verrät alles; 1 = mehrere Sätze nötig; 2 = nur der ganze Text ergibt es.
            - distractors: 0 = Falle offensichtlich falsch; 1 = Falle nimmt ein Textdetail; 2 = feine Falle.
            - language: 0 = Grundwortschatz; 1 = ein Randwort; 2 = schwierige Struktur.
            Summe 0–1 EASY, 2–4 MEDIUM, 5–6 HARD, 7–8 EXPERT (EXPERT: Falle ist halb richtig und die Aussage
            ergibt sich aus mehreren Textteilen).
            Pro Text außerdem: "evidence" (wörtliches Zitat aus dem Text), "trap" (Fallenregel auf Deutsch),
            "explanationVi" (VIETNAMESISCH: warum {1} passt und warum {2} nicht; Überschriften NUR als {1} und
            {2} bezeichnen), "selfScore".
            Antworte NUR mit JSON: {"items": [{"slot": 0, "headline": "...", "nearHeadline": "...", "trap": "...",
              "evidence": "...", "explanationVi": "...", "selfScore": {}}]}
            """;

    JsonNode generateItems(long userId, TeilSpec spec, Text text, List<int[]> slotIdx, List<String> slotLevels,
                           List<Item> keep, List<String> avoid) {
        return generateItems(userId, spec, text, slotIdx, slotLevels, keep, avoid, Map.of());
    }

    /** {@code hints}: slot → lời nhắc tiếng Đức vì sao lượt trước không đúng công thức của bậc (sinh lại một lần). */
    JsonNode generateItems(long userId, TeilSpec spec, Text text, List<int[]> slotIdx, List<String> slotLevels,
                           List<Item> keep, List<String> avoid, Map<Integer, String> hints) {
        if (spec.headlines()) return generateHeadlines(userId, spec, text, slotIdx, slotLevels, keep, avoid);
        String system = ITEMS_SYSTEM.formatted(spec.cefrLevel(), spec.cefrLevel());
        StringBuilder u = new StringBuilder();
        u.append("TEXT\nÜberschrift: ").append(text.titleDe()).append("\nVorspann: ").append(text.vorspannDe())
                .append("\n");
        List<String> paras = TextChecks.paragraphs(text.context());
        for (int i = 0; i < paras.size(); i++) u.append("[Absatz ").append(i + 1).append("] ").append(paras.get(i)).append("\n");
        u.append("\nErstelle diese Aufgaben (slot → Schwierigkeit):\n");
        for (int i = 0; i < slotIdx.size(); i++) {
            u.append("slot ").append(slotIdx.get(i)[0]).append(" → ").append(slotLevels.get(i)).append("\n");
        }
        if (!keep.isEmpty()) {
            u.append("\nBereits vorhandene Aufgaben (nicht wiederholen, andere Textstellen prüfen):\n");
            for (Item it : keep) u.append("- ").append(it.question()).append(" ").append(it.options().get(it.correct())).append("\n");
        }
        if (hints != null && !hints.isEmpty()) {
            u.append("\nKORREKTUR — der erste Versuch hielt den Bauplan nicht ein. Schreibe diese Aufgaben neu:\n");
            hints.forEach((slot, hint) -> u.append("slot ").append(slot).append(": ").append(hint).append("\n"));
        }
        u.append(SituationalTeile.avoidBlock(avoid));
        return callAs(Role.WRITER, userId, "ITEMS", system, u.toString(), 0.7, 4_500);
    }

    JsonNode generateHeadlines(long userId, TeilSpec spec, Text text, List<int[]> slotIdx, List<String> slotLevels,
                               List<Item> keep, List<String> avoid) {
        StringBuilder u = new StringBuilder("TEXTE\n");
        List<String> paras = TextChecks.paragraphs(text.context());
        for (int i = 0; i < paras.size(); i++) u.append("[Text ").append(i + 1).append("] ").append(paras.get(i)).append("\n");
        u.append("\nSchreibe Überschriften für (slot → Text → Schwierigkeit):\n");
        for (int i = 0; i < slotIdx.size(); i++) {
            int sl = slotIdx.get(i)[0];
            u.append("slot ").append(sl).append(" → Text ").append(sl + 1).append(" → ").append(slotLevels.get(i)).append("\n");
        }
        if (!keep.isEmpty()) {
            u.append("\nSchon vergebene Überschriften (nicht wiederholen):\n");
            for (Item it : keep) it.options().values().forEach(h -> u.append("- ").append(h).append("\n"));
        }
        u.append(SituationalTeile.avoidBlock(avoid));
        return call(userId, "ITEMS", LlmTier.CONTENT, ITEMS_T1_SYSTEM.formatted(spec.cefrLevel(), spec.cefrLevel()),
                u.toString(), 0.7, 2_500);
    }

    // ── 4. Tự kiểm: chấm thang, giải thử ─────────────────────────────────────────────────────

    static final String RUBRIC_SYSTEM = """
            Du bist Prüfungsexperte für telc %s. Bewerte jede Aufgabe (Lösung ist angegeben) nach der Skala,
            je 0–2: phrasing (0 Wörter aus dem Text wiederholt / 1 umformuliert / 2 erschlossen),
            evidence (0 ein Satz / 1 ein Absatz / 2 ≥ 2 Absätze), distractors (0 offensichtlich falsch /
            1 Textdetail falsch zugeordnet / 2 feine Falle), language (0 Grundwortschatz / 1 ein Randwort /
            2 schwierige Struktur). Außerdem: multiParagraph (Lösung braucht ≥ 2 Absätze) und halfTrue
            (ein Distraktor ist halb richtig). Sei streng und unabhängig von früheren Einschätzungen.
            Prüfe zusätzlich jede Aufgabe:
            - supported: Ist der vollständige Satz aus Aufgabentext + angegebener Lösung eine Aussage, die der
              Text belegt, UND stimmt jede Zahl, Menge oder Gruppe im Aufgabentext mit dem Text überein? Wenn
              nicht: false und in "issueVi" in EINEM vietnamesischen Satz sagen, was nicht stimmt.
            - absurd: Wie viele der falschen Optionen (0, 1 oder 2) erkennt man OHNE den Text als falsch, weil
              sie übertrieben oder unlogisch sind?
            Antworte NUR mit JSON: {"items": [{"id": "...", "phrasing": 0, "evidence": 0, "distractors": 0,
              "language": 0, "multiParagraph": false, "halfTrue": false, "supported": true, "issueVi": null,
              "absurd": 0}]}
            """;

    JsonNode rubric(long userId, TeilSpec spec, Text text, List<Item> items) {
        return call(userId, "VERIFY", LlmTier.GRADING_EXAM, RUBRIC_SYSTEM.formatted(spec.cefrLevel()),
                textBlock(spec, text) + "\nAUFGABEN MIT LÖSUNG:\n" + itemsBlock(spec, items, true), 0.0, 2_000);
    }

    static final String SOLVE_SYSTEM = """
            Löse die Aufgaben zum Text. Wähle pro Aufgabe den Buchstaben der passenden Option bzw. Überschrift
            (jede Überschrift höchstens einmal).
            Antworte NUR mit JSON: {"answers": [{"id": "...", "answer": "a"}]}
            """;

    static final String WEAK_SOLVE_SYSTEM = """
            Du bist ein Deutschlerner auf Niveau A2. Du liest langsam und verstehst schwierige Sätze
            nicht immer. Löse die Aufgaben zum Text so, wie ein A2-Lerner es tun würde (wähle den Buchstaben).
            Antworte NUR mit JSON: {"answers": [{"id": "...", "answer": "a"}]}
            """;

    static final String BLIND_SOLVE_SYSTEM = """
            Du siehst NUR Aufgaben, keinen Text. Gib eine Antwort nur dann an, wenn du die Lösung ohne Text
            sicher erkennen kannst (z. B. weil nur eine Option logisch oder allgemein bekannt ist);
            sonst "answer": null. Antworte NUR mit JSON: {"answers": [{"id": "...", "answer": null}]}
            """;

    // ── 4b. Kiểm bài khớp dữ kiện; giải khi chỉ thấy một đoạn ─────────────────────────────────

    static final String FAITHFUL_SYSTEM = """
            Du prüfst einen Lesetext für eine Deutschprüfung gegen die FAKTEN seiner Quellen. Zu jeder Quelle
            siehst du Herausgeber, Titel und Datum, die VERWENDETEN Fakten und WEITERE Fakten derselben Quelle.
            Alles, was in einer der beiden Listen oder in den Angaben zur Quelle steht, gilt als belegt.

            Melde NUR Sätze mit einem inhaltlichen Fehler und stufe jeden ein.
            SERIOUS — ein Lernender würde etwas Falsches lernen oder eine Aufgabe falsch lösen:
            - UNSUPPORTED: eine konkrete Zahl, ein Jahr, ein Name oder ein Ergebnis, das in keinem Fakt steht
              oder einem Fakt widerspricht;
            - CAUSAL: Ursache und Wirkung behauptet, obwohl der Fakt nur einen Zusammenhang nennt (oder umgekehrt);
            - WRONG_LINK: eine Aussage der falschen Gruppe, Zeit oder Sache zugeordnet (auch durch ein Pronomen
              oder "diese", das sich auf den falschen Satz bezieht).
            MINOR — ungenau, aber nicht falsch: sinnvoll gerundete Zahl ("fast die Hälfte" für 48 Prozent),
            vereinfachte oder leicht verallgemeinerte Formulierung, weggelassene Einschränkung.

            NICHT melden: andere Wortwahl oder Satzstellung, Zusammenfassung mehrerer Fakten in einem Satz,
            allgemeine Erklärungen, Überleitungen und Alltagswissen ohne neue Zahlen oder Ergebnisse, die Nennung
            von Herausgeber, Titel oder Datum der Quelle, Worterklärungen.
            Im Zweifel MINOR oder gar nicht melden. "problemVi" auf VIETNAMESISCH, ein Satz.
            Antworte NUR mit JSON: {"issues": [{"sentence": "wörtlicher Satz aus dem Text",
              "type": "UNSUPPORTED|CAUSAL|WRONG_LINK", "severity": "SERIOUS|MINOR", "problemVi": "..."}]}
            """;

    /** Khối nguồn đưa cho máy chấm: tên nguồn, ngày, dữ kiện đã tích VÀ dữ kiện cùng nguồn chưa tích. */
    static String sourcesBlock(List<Source> sources) {
        StringBuilder sb = new StringBuilder();
        int n = 0;
        for (Source s : sources) {
            sb.append("QUELLE ").append(++n).append(": ")
                    .append(s.publisher() == null || s.publisher().isBlank() ? "(Herausgeber unbekannt)" : s.publisher());
            if (s.title() != null && !s.title().isBlank()) sb.append(" — „").append(s.title()).append("“");
            if (s.author() != null && !s.author().isBlank()) sb.append(", ").append(s.author());
            if (s.publishedAt() != null && !s.publishedAt().isBlank()) sb.append(" (").append(s.publishedAt()).append(")");
            sb.append("\nVERWENDETE FAKTEN:\n").append(factLines(s.facts().stream().filter(Fact::selected).toList()));
            List<Fact> rest = s.facts().stream().filter(f -> !f.selected()).toList();
            if (!rest.isEmpty()) sb.append("WEITERE FAKTEN DERSELBEN QUELLE:\n").append(factLines(rest));
            sb.append("\n");
        }
        return sb.toString();
    }

    private static String factLines(List<Fact> facts) {
        if (facts.isEmpty()) return "(keine)\n";
        return facts.stream().map(f -> "- " + f.text()
                + (f.figure() == null ? "" : " [Zahl: " + f.figure() + "]")
                + (f.year() == null ? "" : " [Jahr: " + f.year() + "]") + "\n").collect(Collectors.joining());
    }

    JsonNode faithfulness(long userId, TeilSpec spec, Text text, List<Source> sources) {
        return callAs(Role.JUDGE, userId, "VERIFY", FAITHFUL_SYSTEM,
                sourcesBlock(sources) + "\n" + textBlock(spec, text), 0.0, 1_500);
    }

    static final String ONE_PARAGRAPH_SYSTEM = """
            Zu jeder Aufgabe siehst du NUR EINEN Absatz eines längeren Textes. Gib eine Antwort nur dann an,
            wenn dieser eine Absatz die Lösung sicher belegt und kein weiterer Absatz nötig ist; sonst
            "answer": null. Rate nicht.
            Antworte NUR mit JSON: {"answers": [{"id": "...", "answer": null}]}
            """;

    /** {@code paragraphOf}: mã câu → đoạn duy nhất AI được xem. Câu giải được ở đây không phải câu gộp hai đoạn. */
    JsonNode solveOneParagraph(long userId, List<Item> items, Map<String, String> paragraphOf) {
        StringBuilder sb = new StringBuilder();
        for (Item it : items) {
            String para = paragraphOf.get(it.id());
            if (para == null) continue;
            sb.append(it.id()).append("\n  Absatz: ").append(para).append("\n  Aufgabe: ").append(it.question()).append("\n");
            for (String l : ItemRules.LETTERS) sb.append("  ").append(l).append(") ").append(it.options().get(l)).append("\n");
        }
        return call(userId, "VERIFY", LlmTier.GRADING_EXAM, ONE_PARAGRAPH_SYSTEM, sb.toString(), 0.0, 800);
    }

    JsonNode solveStrong(long userId, TeilSpec spec, Text text, List<Item> items) {
        return call(userId, "VERIFY", LlmTier.GRADING_EXAM, SOLVE_SYSTEM,
                textBlock(spec, text) + "\nAUFGABEN:\n" + itemsBlock(spec, items, false), 0.0, 800);
    }

    JsonNode solveWeak(long userId, TeilSpec spec, Text text, List<Item> items) {
        return call(userId, "VERIFY", LlmTier.CHAT_FREE, WEAK_SOLVE_SYSTEM,
                textBlock(spec, text) + "\nAUFGABEN:\n" + itemsBlock(spec, items, false), 0.3, 800);
    }

    JsonNode solveBlind(long userId, TeilSpec spec, List<Item> items) {
        return call(userId, "VERIFY", LlmTier.GRADING_EXAM, BLIND_SOLVE_SYSTEM,
                "AUFGABEN:\n" + itemsBlock(spec, items, false), 0.0, 800);
    }

    static String textBlock(TeilSpec spec, Text text) {
        List<String> paras = TextChecks.paragraphs(text.context());
        StringBuilder sb = new StringBuilder();
        if (spec.headlines()) {
            sb.append("TEXTE\n");
            for (int i = 0; i < paras.size(); i++) sb.append("[Text ").append(i + 1).append("] ").append(paras.get(i)).append("\n");
            return sb.toString();
        }
        sb.append("TEXT\n").append(text.titleDe()).append("\n").append(text.vorspannDe()).append("\n");
        for (int i = 0; i < paras.size(); i++) sb.append("[Absatz ").append(i + 1).append("] ").append(paras.get(i)).append("\n");
        return sb.toString();
    }

    static String itemsBlock(TeilSpec spec, List<Item> items, boolean withKey) {
        StringBuilder sb = new StringBuilder();
        if (spec.headlines()) {
            Map<String, String> all = new TreeMap<>();
            for (Item it : items) all.putAll(it.options());
            sb.append("ÜBERSCHRIFTEN\n");
            all.forEach((l, h) -> sb.append("  ").append(l).append(") ").append(h).append("\n"));
            for (Item it : items) {
                sb.append(it.id()).append(": ").append(it.question()).append("\n");
                if (withKey) sb.append("  Lösung: ").append(it.correct()).append("\n");
            }
            return sb.toString();
        }
        for (Item it : items) {
            sb.append(it.id()).append(": ").append(it.question()).append("\n");
            for (String l : ItemRules.LETTERS) sb.append("  ").append(l).append(") ").append(it.options().get(l)).append("\n");
            if (withKey) sb.append("  Lösung: ").append(it.correct()).append("\n");
        }
        return sb.toString();
    }
}
