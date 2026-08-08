package com.deutschflow.ai;

import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.exception.AiServiceException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * One-shot text helpers (grammar, translation, free-form generation) on top of the ACTIVE
 * {@link OpenAiChatClient} bean.
 *
 * <p>Why this exists: {@link AIModelService} talks to the self-hosted Python AI server at
 * {@code app.ai.server-url} and nothing else. Callers that injected it directly therefore bypassed
 * {@code AiChatClientFactory} — the switch that picks Groq in production and the local server in
 * dev — so on prod every one of those endpoints hit a host that isn't running and answered 500
 * (QA 03/08: Ngữ pháp AI, sinh bài tập ngữ pháp). Routing through the interface instead keeps dev
 * behaviour identical (the local provider still reaches the Python server via
 * {@code LocalAiChatClient}) while prod follows the same provider as speaking and grading.
 *
 * <p>Failures surface as {@link AiServiceException} → HTTP 503 with a Vietnamese message, never as
 * an opaque 500.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiTextService {

    private static final double GRAMMAR_TEMPERATURE = 0.2;
    private static final int CORRECTION_MAX_TOKENS = 512;
    private static final int EXPLANATION_MAX_TOKENS = 700;

    private static final String CORRECT_SYSTEM_PROMPT = """
            Du bist ein Deutschlehrer. Korrigiere den folgenden deutschen Satz.
            Antworte AUSSCHLIESSLICH mit dem korrigierten Satz — keine Erklärung, keine
            Anführungszeichen, kein Vorwort. Ist der Satz bereits korrekt, gib ihn unverändert zurück.
            """;

    private static final String EXPLAIN_SYSTEM_PROMPT = """
            Bạn là giáo viên tiếng Đức, giải thích cho người Việt học tiếng Đức.
            Giải thích ngắn gọn (tối đa 4 câu, bằng TIẾNG VIỆT) các điểm ngữ pháp đáng chú ý trong
            câu tiếng Đức được đưa: lỗi sai nếu có, quy tắc liên quan và cách dùng đúng.
            Không lặp lại nguyên văn câu gốc, không viết mở đầu thừa.
            """;

    private final OpenAiChatClient chatClient;
    // Khung tier B2: sửa câu + giải thích lỗi dạy QUY TẮC cho học viên → tier EXPLAIN
    // (P2 giữ model hiện trạng, P3 flip Haiku sau calibration).
    private final LlmTierResolver llmTierResolver;

    /**
     * Free-form generation. {@code instruction} becomes the system prompt, {@code input} the user
     * message — the same contract the old {@code AIModelService.generate} exposed, so call sites
     * port over unchanged.
     */
    public String generate(String instruction, String input, int maxTokens, double temperature) {
        List<ChatMessage> messages = (input == null || input.isBlank())
                ? List.of(new ChatMessage("user", instruction))
                : List.of(new ChatMessage("system", instruction), new ChatMessage("user", input));
        return complete(messages, temperature, maxTokens);
    }

    /** Corrected version of {@code germanText} (returned unchanged when already correct). */
    public String correctGrammar(String germanText) {
        return complete(
                List.of(new ChatMessage("system", CORRECT_SYSTEM_PROMPT),
                        new ChatMessage("user", germanText)),
                GRAMMAR_TEMPERATURE, CORRECTION_MAX_TOKENS);
    }

    /** Vietnamese explanation of the grammar at play in {@code germanText}. */
    public String explainGrammar(String germanText) {
        return complete(
                List.of(new ChatMessage("system", EXPLAIN_SYSTEM_PROMPT),
                        new ChatMessage("user", germanText)),
                GRAMMAR_TEMPERATURE, EXPLANATION_MAX_TOKENS);
    }

    private String complete(List<ChatMessage> messages, double temperature, int maxTokens) {
        AiChatCompletionResult result;
        try {
            result = chatClient.chatCompletionForTier(
                    messages, llmTierResolver.spec(LlmTier.EXPLAIN), temperature, maxTokens);
        } catch (AiServiceException e) {
            throw e;
        } catch (Exception e) {
            log.error("[AiText] Lời gọi AI thất bại", e);
            throw new AiServiceException("Dịch vụ AI tạm thời không khả dụng, vui lòng thử lại.", e);
        }
        if (result == null || result.content() == null || result.content().isBlank()) {
            throw new AiServiceException("Dịch vụ AI không trả về nội dung, vui lòng thử lại.");
        }
        return result.content().trim();
    }
}
