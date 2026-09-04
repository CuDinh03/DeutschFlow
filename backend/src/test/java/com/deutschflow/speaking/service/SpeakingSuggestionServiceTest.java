package com.deutschflow.speaking.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.TokenUsage;
import com.deutschflow.speaking.entity.AiSpeakingMessage;
import com.deutschflow.speaking.entity.AiSpeakingMessage.MessageRole;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.exception.AiServiceException;
import com.deutschflow.speaking.repository.AiSpeakingMessageRepository;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Đ4 — endpoint gợi ý theo yêu cầu: hợp đồng sở hữu phiên, câu hỏi cuối, parse và ledger. */
@ExtendWith(MockitoExtension.class)
class SpeakingSuggestionServiceTest {

    @Mock private AiSpeakingSessionRepository sessionRepository;
    @Mock private AiSpeakingMessageRepository messageRepository;
    @Mock private OpenAiChatClient openAiChatClient;
    @Mock private QuotaService quotaService;
    @Mock private AiUsageLedgerService ledgerService;

    private SpeakingSuggestionService service;

    @BeforeEach
    void setUp() {
        service = new SpeakingSuggestionService(sessionRepository, messageRepository,
                openAiChatClient, quotaService, ledgerService, new ObjectMapper());
    }

    private AiSpeakingSession session(long userId) {
        AiSpeakingSession s = new AiSpeakingSession();
        s.setUserId(userId);
        s.setCefrLevel("B1");
        return s;
    }

    private AiSpeakingMessage assistantMsg(String speech) {
        return AiSpeakingMessage.builder().role(MessageRole.ASSISTANT).aiSpeechDe(speech).build();
    }

    @Test
    @DisplayName("happy path: parse 2 gợi ý + ghi ledger SPEAKING_SUGGESTIONS")
    void returnsParsedSuggestionsAndRecordsLedger() {
        when(sessionRepository.findById(11L)).thenReturn(Optional.of(session(7L)));
        when(messageRepository.findTop10BySessionIdOrderByCreatedAtDesc(11L))
                .thenReturn(List.of(assistantMsg("Was hast du am Wochenende gemacht?")));
        when(openAiChatClient.chatCompletion(any(), any(), anyDouble(), anyInt()))
                .thenReturn(new AiChatCompletionResult("""
                        {"suggestions":[
                          {"german_text":"Ich war zu Hause.","vietnamese_translation":"Tôi ở nhà.","level":"B1"},
                          {"german_text":"Ich habe mit Freunden Fußball gespielt.","vietnamese_translation":"Tôi đá bóng với bạn.","level":"B1"}
                        ]}""", TokenUsage.exact(200, 60, 260), "GROQ", "openai/gpt-oss-20b"));

        var out = service.suggestForLastAiTurn(7L, 11L);

        assertThat(out).hasSize(2);
        assertThat(out.get(0).germanText()).isEqualTo("Ich war zu Hause.");
        assertThat(out.get(1).vietnameseTranslation()).isEqualTo("Tôi đá bóng với bạn.");
        verify(quotaService).assertAllowed(eq(7L), any(), eq(1L));
        // Ledger nhận nguyên TokenUsage (V270) thay vì 3 số rời — nhờ vậy phần prompt được cache
        // cũng vào sổ và COGS thôi khai vống; số token vẫn y như trước.
        verify(ledgerService).record(eq(7L), eq("GROQ"), eq("openai/gpt-oss-20b"),
                eq(TokenUsage.exact(200, 60, 260)), eq("SPEAKING_SUGGESTIONS"), any(), eq(11L));
    }

    @Test
    @DisplayName("phiên của người khác: NotFound (không lộ tồn tại), KHÔNG gọi LLM")
    void foreignSessionIsNotFound() {
        when(sessionRepository.findById(11L)).thenReturn(Optional.of(session(999L)));

        assertThatThrownBy(() -> service.suggestForLastAiTurn(7L, 11L))
                .isInstanceOf(NotFoundException.class);
        verify(openAiChatClient, never()).chatCompletion(any(), any(), anyDouble(), anyInt());
    }

    @Test
    @DisplayName("phiên chưa có lượt trợ lý nào: NotFound, KHÔNG tốn quota/LLM")
    void sessionWithoutAssistantTurnIsNotFound() {
        when(sessionRepository.findById(11L)).thenReturn(Optional.of(session(7L)));
        when(messageRepository.findTop10BySessionIdOrderByCreatedAtDesc(11L)).thenReturn(List.of());

        assertThatThrownBy(() -> service.suggestForLastAiTurn(7L, 11L))
                .isInstanceOf(NotFoundException.class);
        verify(openAiChatClient, never()).chatCompletion(any(), any(), anyDouble(), anyInt());
    }

    @Test
    @DisplayName("JSON hỏng/rỗng: AiServiceException câu trung tính — client retry được")
    void unparseablePayloadBecomesNeutralAiError() {
        when(sessionRepository.findById(11L)).thenReturn(Optional.of(session(7L)));
        when(messageRepository.findTop10BySessionIdOrderByCreatedAtDesc(11L))
                .thenReturn(List.of(assistantMsg("Frage?")));
        when(openAiChatClient.chatCompletion(any(), any(), anyDouble(), anyInt()))
                .thenReturn(new AiChatCompletionResult("{\"suggestions\":[]}", null, "GROQ", "m"));

        assertThatThrownBy(() -> service.suggestForLastAiTurn(7L, 11L))
                .isInstanceOfSatisfying(AiServiceException.class, ex ->
                        assertThat(ex.getMessage()).doesNotContain("json").doesNotContain("parse"));
    }

    @Test
    @DisplayName("prompt hệ thống nhắc chữ JSON (bắt buộc cho json-mode của Groq)")
    void instructionMentionsJsonForGroqJsonMode() {
        when(sessionRepository.findById(11L)).thenReturn(Optional.of(session(7L)));
        when(messageRepository.findTop10BySessionIdOrderByCreatedAtDesc(11L))
                .thenReturn(List.of(assistantMsg("Frage?")));
        when(openAiChatClient.chatCompletion(any(), any(), anyDouble(), anyInt()))
                .thenAnswer(inv -> {
                    List<com.deutschflow.speaking.ai.ChatMessage> msgs = inv.getArgument(0);
                    assertThat(msgs.get(0).content()).containsIgnoringCase("json");
                    assertThat(msgs.get(0).content()).contains("B1");
                    return new AiChatCompletionResult(
                            "{\"suggestions\":[{\"german_text\":\"Ja.\"}]}", null, "GROQ", "m");
                });

        assertThat(service.suggestForLastAiTurn(7L, 11L)).hasSize(1);
    }
}
