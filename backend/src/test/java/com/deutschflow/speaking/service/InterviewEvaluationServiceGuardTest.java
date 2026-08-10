package com.deutschflow.speaking.service;

import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.entity.AiSpeakingMessage;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.interview.InterviewReportValidator;
import com.deutschflow.speaking.interview.InterviewStateCodec;
import com.deutschflow.speaking.repository.AiSpeakingMessageRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Đợt A (10/08) — guard đủ-dữ-liệu: phiên ứng viên im lặng/nói quá ít KHÔNG được gọi LLM chấm
 * (chống report bịa kiểu prod sid 356/357: 0 lời user vẫn được khen "tiếng Đức trôi chảy" 6.0/10).
 */
@ExtendWith(MockitoExtension.class)
class InterviewEvaluationServiceGuardTest {

    @Mock private AiSpeakingMessageRepository messageRepository;
    @Mock private OpenAiChatClient openAiChatClient;
    @Mock private QuotaService quotaService;
    @Mock private AiUsageLedgerService ledgerService;
    @Mock private LlmTierResolver llmTierResolver;

    private InterviewEvaluationService service;

    @BeforeEach
    void setUp() {
        ObjectMapper om = new ObjectMapper();
        service = new InterviewEvaluationService(messageRepository, openAiChatClient, quotaService,
                ledgerService, new InterviewStateCodec(om), new InterviewReportValidator(om),
                llmTierResolver);
    }

    private static AiSpeakingSession session() {
        return AiSpeakingSession.builder().userId(7L).sessionMode("INTERVIEW")
                .interviewPosition("Kellner").experienceLevel("1-2Y").cefrLevel("A2").build();
    }

    private static AiSpeakingMessage ai(String text) {
        return AiSpeakingMessage.builder().role(AiSpeakingMessage.MessageRole.ASSISTANT).aiSpeechDe(text).build();
    }

    private static AiSpeakingMessage user(String text) {
        return AiSpeakingMessage.builder().role(AiSpeakingMessage.MessageRole.USER).userText(text).build();
    }

    @Test
    @DisplayName("phiên chỉ có greeting AI (0 lời user) → INSUFFICIENT_DATA, không gọi LLM/quota")
    void greetingOnly_returnsInsufficient_withoutLlmCall() {
        when(messageRepository.findBySessionIdOrderByCreatedAtAsc(any()))
                .thenReturn(List.of(ai("Danke. Bitte stellen Sie sich kurz vor.")));

        String report = service.generateReport(session(), 7L);

        assertThat(report).contains("\"type\":\"INSUFFICIENT_DATA\"").contains("\"user_turns\":0");
        verifyNoInteractions(openAiChatClient, quotaService, ledgerService, llmTierResolver);
    }

    @Test
    @DisplayName("đủ 2 lượt nhưng dưới 30 từ → vẫn INSUFFICIENT_DATA")
    void tooFewWords_returnsInsufficient() {
        when(messageRepository.findBySessionIdOrderByCreatedAtAsc(any()))
                .thenReturn(List.of(
                        ai("Bitte stellen Sie sich vor."), user("Hallo. Ich heiße Tuan."),
                        ai("Warum diese Stelle?"), user("Ich weiß nicht.")));

        String report = service.generateReport(session(), 7L);

        assertThat(report).contains("\"type\":\"INSUFFICIENT_DATA\"").contains("\"user_turns\":2");
        verifyNoInteractions(openAiChatClient, quotaService);
    }

    @Test
    @DisplayName("không có message nào → giữ hành vi cũ: null")
    void emptyMessages_returnsNull() {
        when(messageRepository.findBySessionIdOrderByCreatedAtAsc(any())).thenReturn(List.of());

        assertThat(service.generateReport(session(), 7L)).isNull();
        verifyNoInteractions(openAiChatClient, quotaService);
    }
}
