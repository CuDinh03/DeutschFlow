package com.deutschflow.vocabulary.galerie.service;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.core.JsonValue;
import com.anthropic.models.beta.messages.BetaCacheControlEphemeral;
import com.anthropic.models.beta.messages.BetaMessage;
import com.anthropic.models.beta.messages.BetaStopReason;
import com.anthropic.models.beta.messages.BetaTextBlock;
import com.anthropic.models.beta.messages.BetaTextBlockParam;
import com.anthropic.models.beta.messages.MessageCreateParams;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Wrapper duy nhất quanh Anthropic Java SDK cho Galerie (model chốt: {@code claude-fable-5},
 * owner A/B 16/08). Các ràng buộc Fable 5 tuân theo migration guide:
 *
 * <ul>
 *   <li>KHÔNG gửi param {@code thinking} — Fable luôn bật thinking, gửi disabled/enabled là 400.</li>
 *   <li>{@code stop_reason == "refusal"} phải xử lý TRƯỚC khi đọc content (HTTP 200, content rỗng
 *       hoặc dở dang).</li>
 *   <li>Bật server-side fallback mặc định: beta {@code server-side-fallback-2026-07-01} +
 *       {@code fallbacks: "default"} — request bị classifier từ chối được model fallback trả lời
 *       trong cùng lời gọi. SDK 2.34.0 chưa có builder typed cho dạng scalar này nên đi qua
 *       {@code putAdditionalBodyProperty}.</li>
 *   <li>Prompt caching: cache_control ephemeral trên block anchors (block cuối của prefix ổn định
 *       system+anchors) — min cacheable Fable = 512 token, khối này vài nghìn token nên đủ.</li>
 * </ul>
 *
 * <p>Client SDK khởi tạo LAZY: bật {@code GALERIE_SVG_ENABLED} mà thiếu {@code ANTHROPIC_API_KEY}
 * thì app vẫn boot bình thường (blue-green không sập), chỉ lời gọi generate trả lỗi cấu hình.
 */
@Slf4j
@Component
public class GalerieAnthropicClient {

    private static final String FALLBACK_BETA = "server-side-fallback-2026-07-01";

    private final boolean enabled;
    private final String model;
    private final long maxOutputTokens;

    private volatile AnthropicClient client;

    public GalerieAnthropicClient(
            @Value("${app.galerie.enabled}") boolean enabled,
            @Value("${app.galerie.model}") String model,
            @Value("${app.galerie.max-output-tokens}") long maxOutputTokens) {
        this.enabled = enabled;
        this.model = model;
        this.maxOutputTokens = maxOutputTokens;
    }

    /** Đủ điều kiện gọi thật: flag bật + có key trong môi trường (SDK đọc ANTHROPIC_API_KEY). */
    public boolean isConfigured() {
        return enabled && System.getenv("ANTHROPIC_API_KEY") != null
                && !System.getenv("ANTHROPIC_API_KEY").isBlank();
    }

    public String model() {
        return model;
    }

    public SvgCompletion complete(String systemPrompt, String anchorsBlock, String userMessage) {
        MessageCreateParams params = MessageCreateParams.builder()
                .model(model)
                .maxTokens(maxOutputTokens)
                .addBeta(FALLBACK_BETA)
                .putAdditionalBodyProperty("fallbacks", JsonValue.from("default"))
                .systemOfBetaTextBlockParams(List.of(
                        BetaTextBlockParam.builder().text(systemPrompt).build(),
                        BetaTextBlockParam.builder()
                                .text(anchorsBlock)
                                .cacheControl(BetaCacheControlEphemeral.builder().build())
                                .build()))
                .addUserMessage(userMessage)
                .build();

        BetaMessage response = clientInstance().beta().messages().create(params);

        boolean refused = BetaStopReason.REFUSAL.equals(response.stopReason());
        String text = refused ? "" : response.content().stream()
                .flatMap(block -> block.text().stream())
                .map(BetaTextBlock::text)
                .collect(Collectors.joining());

        return new SvgCompletion(
                text,
                response.model().toString(),
                (int) response.usage().inputTokens(),
                (int) response.usage().outputTokens(),
                refused,
                response.id());
    }

    private AnthropicClient clientInstance() {
        AnthropicClient existing = client;
        if (existing != null) {
            return existing;
        }
        synchronized (this) {
            if (client == null) {
                // fromEnv() đọc ANTHROPIC_API_KEY; isConfigured() đã gate trước khi tới đây.
                client = AnthropicOkHttpClient.fromEnv();
            }
            return client;
        }
    }

    /**
     * @param refused {@code true} khi classifier từ chối và cả chuỗi fallback cũng từ chối —
     *                caller KHÔNG được đọc {@code text} như artwork hợp lệ.
     */
    public record SvgCompletion(String text, String servedByModel, int inputTokens,
                                int outputTokens, boolean refused, String responseId) {}
}
