package com.deutschflow.speaking.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.entity.AiSpeakingMessage;
import com.deutschflow.speaking.entity.AiSpeakingMessage.MessageRole;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.exception.AiServiceException;
import com.deutschflow.speaking.repository.AiSpeakingMessageRepository;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** K4 — dịch câu trợ lý trong phiên theo yêu cầu: sở hữu phiên, bản đã lưu không gọi AI, lưu bản mới. */
@ExtendWith(MockitoExtension.class)
class SpeakingMessageTranslationServiceTest {

    @Mock private AiSpeakingSessionRepository sessionRepository;
    @Mock private AiSpeakingMessageRepository messageRepository;
    @Mock private OpenAiChatClient openAiChatClient;
    @Mock private QuotaService quotaService;
    @Mock private AiUsageLedgerService ledgerService;

    private SpeakingMessageTranslationService service;
    private final AtomicInteger budgetChecks = new AtomicInteger();

    @BeforeEach
    void setUp() {
        service = new SpeakingMessageTranslationService(sessionRepository, messageRepository,
                openAiChatClient, quotaService, ledgerService, new ObjectMapper());
    }

    private void ownedSession() {
        AiSpeakingSession s = new AiSpeakingSession();
        s.setUserId(7L);
        when(sessionRepository.findById(10L)).thenReturn(Optional.of(s));
    }

    private AiSpeakingMessage assistant(String speech) {
        return AiSpeakingMessage.builder().id(99L).sessionId(10L).role(MessageRole.ASSISTANT)
                .aiSpeechDe(speech).build();
    }

    @Test
    void firstRequestCallsAi_savesTranslation_andChecksBudget() {
        ownedSession();
        AiSpeakingMessage m = assistant("Wie dokumentieren Sie eine Übergabe?");
        when(messageRepository.findById(99L)).thenReturn(Optional.of(m));
        when(openAiChatClient.chatCompletion(anyList(), isNull(), anyDouble(), anyInt()))
                .thenReturn(new AiChatCompletionResult("{\"translation\":\"  Bạn ghi chép   bàn giao ca thế nào? \"}",
                        null, "groq", "m"));

        var dto = service.translate(7L, 10L, 99L, "VI", budgetChecks::incrementAndGet);

        assertThat(dto.lang()).isEqualTo("vi");
        assertThat(dto.text()).isEqualTo("Bạn ghi chép bàn giao ca thế nào?");
        assertThat(m.getTranslationVi()).isEqualTo("Bạn ghi chép bàn giao ca thế nào?");
        assertThat(m.getTranslationEn()).isNull();
        assertThat(budgetChecks.get()).isEqualTo(1);
        verify(messageRepository).save(m);
    }

    @Test
    void cachedTranslationReturnsWithoutAiOrBudget() {
        ownedSession();
        AiSpeakingMessage m = assistant("Haben Sie noch Fragen?");
        m.setTranslationEn("Do you have any questions?");
        when(messageRepository.findById(99L)).thenReturn(Optional.of(m));

        var dto = service.translate(7L, 10L, 99L, "en", budgetChecks::incrementAndGet);

        assertThat(dto.text()).isEqualTo("Do you have any questions?");
        assertThat(budgetChecks.get()).isZero();
        verifyNoInteractions(openAiChatClient, quotaService);
        verify(messageRepository, never()).save(any());
    }

    @Test
    void otherUsersSession_orMessageFromAnotherSession_isNotFound() {
        AiSpeakingSession foreign = new AiSpeakingSession();
        foreign.setUserId(8L);
        when(sessionRepository.findById(10L)).thenReturn(Optional.of(foreign));
        assertThatThrownBy(() -> service.translate(7L, 10L, 99L, "vi", budgetChecks::incrementAndGet))
                .isInstanceOf(NotFoundException.class);

        ownedSession();
        AiSpeakingMessage elsewhere = assistant("Hallo");
        elsewhere.setSessionId(11L);
        when(messageRepository.findById(99L)).thenReturn(Optional.of(elsewhere));
        assertThatThrownBy(() -> service.translate(7L, 10L, 99L, "vi", budgetChecks::incrementAndGet))
                .isInstanceOf(NotFoundException.class);
        verifyNoInteractions(openAiChatClient);
    }

    @Test
    void userMessagesAndUnknownLanguagesAreRejected() {
        assertThatThrownBy(() -> service.translate(7L, 10L, 99L, "de", budgetChecks::incrementAndGet))
                .isInstanceOf(BadRequestException.class);

        ownedSession();
        AiSpeakingMessage user = AiSpeakingMessage.builder().id(99L).sessionId(10L).role(MessageRole.USER)
                .userText("Ich bin Pfleger.").build();
        when(messageRepository.findById(99L)).thenReturn(Optional.of(user));
        assertThatThrownBy(() -> service.translate(7L, 10L, 99L, "vi", budgetChecks::incrementAndGet))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void unparsableAiOutputIsRetryableError_andNothingSaved() {
        ownedSession();
        AiSpeakingMessage m = assistant("Erzählen Sie mehr.");
        when(messageRepository.findById(99L)).thenReturn(Optional.of(m));
        when(openAiChatClient.chatCompletion(anyList(), isNull(), anyDouble(), anyInt()))
                .thenReturn(new AiChatCompletionResult("{\"translation\":\"\"}", null, "groq", "m"));

        assertThatThrownBy(() -> service.translate(7L, 10L, 99L, "vi", budgetChecks::incrementAndGet))
                .isInstanceOf(AiServiceException.class);
        verify(messageRepository, never()).save(any());
        assertThat(SpeakingMessageTranslationService.instruction("vi")).contains("JSON").contains("Vietnamese");
    }
}
