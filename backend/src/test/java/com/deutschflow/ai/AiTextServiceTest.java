package com.deutschflow.ai;

import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.exception.AiServiceException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.ai.tier.TierSpec;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Text AI helpers must ride the ACTIVE chat provider, and must never let a provider failure reach
 * the client as an opaque 500 — that pairing is exactly what broke Ngữ pháp AI on prod (QA 03/08).
 */
@ExtendWith(MockitoExtension.class)
class AiTextServiceTest {

    @Mock
    private OpenAiChatClient chatClient;

    @Mock
    private LlmTierResolver llmTierResolver;

    @InjectMocks
    private AiTextService aiTextService;

    @org.junit.jupiter.api.BeforeEach
    void stubTier() {
        // lenient: vài test không chạm LLM (MockitoExtension strict-stubs)
        org.mockito.Mockito.lenient().when(llmTierResolver.spec(LlmTier.EXPLAIN)).thenReturn(
                new TierSpec(LlmTier.EXPLAIN, "openai/gpt-oss-20b",
                        null, null, null, null, null, null, "low", false, false));
    }

    private void stubReply(String content) {
        when(chatClient.chatCompletionForTier(any(), any(TierSpec.class), anyDouble(), anyInt(), anyBoolean()))
                .thenReturn(new AiChatCompletionResult(content, null, "test", "test-model"));
    }

    @SuppressWarnings("unchecked")
    private List<ChatMessage> capturedMessages() {
        ArgumentCaptor<List<ChatMessage>> captor = ArgumentCaptor.forClass(List.class);
        verify(chatClient).chatCompletionForTier(captor.capture(), any(TierSpec.class), anyDouble(), anyInt(), anyBoolean());
        return captor.getValue();
    }

    @Test
    @DisplayName("correctGrammar trả câu đã sửa, đã cắt khoảng trắng")
    void correctGrammar_returnsTrimmedContent() {
        stubReply("  Ich bin gestern ins Kino gegangen.\n");

        String corrected = aiTextService.correctGrammar("Ich habe gestern ins Kino gegangen.");

        assertEquals("Ich bin gestern ins Kino gegangen.", corrected);
        List<ChatMessage> sent = capturedMessages();
        assertEquals("system", sent.get(0).role());
        assertEquals("user", sent.get(1).role());
        assertEquals("Ich habe gestern ins Kino gegangen.", sent.get(1).content());
    }

    @Test
    @DisplayName("explainGrammar yêu cầu model giải thích bằng tiếng Việt")
    void explainGrammar_asksForVietnamese() {
        stubReply("Động từ chuyển động dùng trợ động từ sein.");

        String explanation = aiTextService.explainGrammar("Ich bin gegangen.");

        assertEquals("Động từ chuyển động dùng trợ động từ sein.", explanation);
        assertTrue(capturedMessages().get(0).content().contains("TIẾNG VIỆT"));
    }

    @Test
    @DisplayName("generate: instruction thành system, input thành user")
    void generate_splitsInstructionAndInput() {
        stubReply("[]");

        aiTextService.generate("Sinh 3 bài tập", "chủ đề Artikel", 4096, 0.7);

        List<ChatMessage> sent = capturedMessages();
        assertEquals(2, sent.size());
        assertEquals("Sinh 3 bài tập", sent.get(0).content());
        assertEquals("chủ đề Artikel", sent.get(1).content());
    }

    @Test
    @DisplayName("generate: input rỗng thì chỉ gửi 1 message user")
    void generate_withoutInput_sendsSingleUserMessage() {
        stubReply("ok");

        aiTextService.generate("Sinh 3 bài tập", "", 4096, 0.7);

        List<ChatMessage> sent = capturedMessages();
        assertEquals(1, sent.size());
        assertEquals("user", sent.get(0).role());
    }

    @Test
    @DisplayName("Lỗi provider giữ nguyên AiServiceException (→ 503), không bọc lại thành 500")
    void providerFailure_propagatesAiServiceException() {
        AiServiceException original = new AiServiceException("Groq đang bận.");
        when(chatClient.chatCompletionForTier(any(), any(TierSpec.class), anyDouble(), anyInt(), anyBoolean())).thenThrow(original);

        AiServiceException thrown = assertThrows(AiServiceException.class,
                () -> aiTextService.correctGrammar("Ich bin."));

        assertSame(original, thrown);
    }

    @Test
    @DisplayName("Lỗi lạ (server tự host chết) cũng thành AiServiceException tiếng Việt")
    void unexpectedFailure_becomesAiServiceException() {
        when(chatClient.chatCompletionForTier(any(), any(TierSpec.class), anyDouble(), anyInt(), anyBoolean()))
                .thenThrow(new IllegalStateException("Connection refused: localhost:8000"));

        AiServiceException thrown = assertThrows(AiServiceException.class,
                () -> aiTextService.explainGrammar("Ich bin."));

        assertEquals("Dịch vụ AI tạm thời không khả dụng, vui lòng thử lại.", thrown.getMessage());
    }

    @Test
    @DisplayName("Nội dung rỗng cũng là lỗi dịch vụ, không trả chuỗi rỗng cho giáo viên")
    void blankContent_becomesAiServiceException() {
        stubReply("   ");

        assertThrows(AiServiceException.class, () -> aiTextService.correctGrammar("Ich bin."));
    }
}
