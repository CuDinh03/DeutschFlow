package com.deutschflow.speaking.service;

import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.ai.tier.TierSpec;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Khoá regression: Sprechen Teil 2 — SINH CÂU HỎI dùng model NÓI mặc định (null), còn CHẤM lượt
 * nói đi tier GRADING_EXAM (khung plans/2026-08-07, B1.2 — trước đây cả hai rơi về model nói).
 *
 * <p>Bug gốc (cùng họ với #94): code cũ truyền {@code "json_object"} vào THAM SỐ MODEL. Vì
 * {@code GroqChatClient} coi mọi chuỗi non-blank là tên model, nó gửi {@code model="json_object"}
 * → Groq trả HTTP 400 → try/catch nuốt lỗi → Teil 2 luôn rơi về fallback một cách âm thầm.
 * JSON output đã được {@code GroqChatClient} ép sẵn bằng {@code response_format}, nên ô model
 * KHÔNG được dùng để bật JSON.
 */
@ExtendWith(MockitoExtension.class)
class SprechenTeil2ServiceModelTest {

    @Mock OpenAiChatClient chatClient;
    @Mock LlmTierResolver llmTierResolver;

    private SprechenTeil2Service service;

    @BeforeEach
    void setUp() {
        // ObjectMapper thật để parse JSON trả về tự nhiên — chỉ mock client AI.
        service = new SprechenTeil2Service(chatClient, llmTierResolver, new ObjectMapper());
    }

    @Test
    @DisplayName("generateAiQuestion truyền model = null (model NÓI mặc định), KHÔNG phải \"json_object\"")
    void generateAiQuestion_passesNullModel() {
        when(chatClient.chatCompletion(any(), nullable(String.class), anyDouble(), any()))
                .thenReturn(new AiChatCompletionResult(
                        "{\"question\":\"Kaufen Sie gern Brot?\"}", null, "GROQ", "default-speaking-model"));

        String question = service.generateAiQuestion("Einkaufen", "Brot");

        // Trả về câu hỏi của AI (không phải fallback "Kaufen Sie gern Brot?" dựng từ wort)
        // → chứng minh nhánh AI đã chạy thật chứ không bị nuốt lỗi.
        assertThat(question).isEqualTo("Kaufen Sie gern Brot?");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ChatMessage>> msgs = ArgumentCaptor.forClass(List.class);
        ArgumentCaptor<String> model = ArgumentCaptor.forClass(String.class);
        verify(chatClient).chatCompletion(msgs.capture(), model.capture(), anyDouble(), any());

        assertThat(model.getValue())
                .as("Sinh câu hỏi nói phải dùng model NÓI mặc định (null), không bao giờ là \"json_object\"")
                .isNull();
        assertPromptMentionsJson(msgs.getValue());
    }

    @Test
    @DisplayName("evaluateTurn đi tier GRADING_EXAM (khung tier B1.2), không còn rơi về model nói")
    void evaluateTurn_routesToGradingExamTier() {
        when(llmTierResolver.spec(LlmTier.GRADING_EXAM)).thenReturn(new TierSpec(LlmTier.GRADING_EXAM, "openai/gpt-oss-120b", null, null, null, null, null, null, null, false, false));
        when(chatClient.chatCompletionForTier(any(), any(TierSpec.class), anyDouble(), any()))
                .thenReturn(new AiChatCompletionResult(
                        "{\"score\":8,\"feedback_vi\":\"Tốt\",\"ai_response_de\":\"Ja, gern.\"}",
                        null, "GROQ", "openai/gpt-oss-120b"));

        Map<String, Object> result = service.evaluateTurn(
                "USER_ASKING", "Einkaufen", "Brot", "Kaufen Sie gern Brot?", null);

        assertThat(result).containsEntry("score", 8);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ChatMessage>> msgs = ArgumentCaptor.forClass(List.class);
        ArgumentCaptor<TierSpec> tier = ArgumentCaptor.forClass(TierSpec.class);
        verify(chatClient).chatCompletionForTier(msgs.capture(), tier.capture(), anyDouble(), any());

        assertThat(tier.getValue().tier())
                .as("Chấm lượt thi phải đi tier GRADING_EXAM — không bao giờ rơi ngầm về model nói")
                .isEqualTo(LlmTier.GRADING_EXAM);
        assertPromptMentionsJson(msgs.getValue());
    }

    /**
     * Groq JSON mode yêu cầu từ "json" xuất hiện trong prompt, nếu không sẽ HTTP 400 (cùng gốc với #94).
     * Khoá lại bất biến này để một lần chỉnh prompt trong tương lai không làm hỏng JSON mode.
     */
    private void assertPromptMentionsJson(List<ChatMessage> messages) {
        String combined = messages.stream()
                .map(ChatMessage::content)
                .reduce("", String::concat)
                .toLowerCase();
        assertThat(combined)
                .as("Groq JSON mode bắt buộc prompt phải chứa từ \"json\" (cùng gốc lỗi với #94)")
                .contains("json");
    }
}
