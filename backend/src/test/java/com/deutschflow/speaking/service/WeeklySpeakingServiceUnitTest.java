package com.deutschflow.speaking.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.ai.tier.TierSpec;
import com.deutschflow.common.quota.QuotaSnapshot;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.WeeklyRubricPromptBuilder;
import com.deutschflow.speaking.ai.WeeklyRubricParser;
import com.deutschflow.speaking.dto.WeeklySpeakingDtos;
import com.deutschflow.speaking.exception.AiServiceException;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import org.springframework.jdbc.core.RowMapper;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WeeklySpeakingServiceUnitTest {
    @Mock org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    @Mock com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    @Mock com.deutschflow.speaking.ai.OpenAiChatClient openAiChatClient;
    @Mock com.deutschflow.speaking.ai.WeeklyRubricPromptBuilder weeklyRubricPromptBuilder;
    @Mock com.deutschflow.speaking.ai.WeeklyRubricParser weeklyRubricParser;
    @Mock com.deutschflow.common.quota.QuotaService quotaService;
    @Mock com.deutschflow.common.quota.AiUsageLedgerService aiUsageLedgerService;
    @Mock WeeklyCompanionRollupService weeklyCompanionRollupService;
    @Mock com.deutschflow.user.repository.UserLearningProfileRepository userLearningProfileRepository;
    @Mock LlmTierResolver llmTierResolver;

    @InjectMocks
    WeeklySpeakingService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }

    /**
     * Khoá regression P2.V1 (mis-route thứ 6): chấm rubric bài nói tuần phải đi tier
     * GRADING_DAILY — trước khung tier, call site truyền model = null nên rơi về model
     * chat mặc định (20b) thay vì model chấm.
     */
    @Test
    @DisplayName("submit chấm rubric tuần đi tier GRADING_DAILY, không còn model null")
    void submit_routesRubricGradingToGradingDailyTier() {
        long userId = 7L;
        Map<String, Object> promptRow = Map.of(
                "id", 1L,
                "week_start_date", Date.valueOf(LocalDate.of(2026, 8, 3)),
                "prompt_de", "Erzählen Sie von Ihrer Woche.");
        when(jdbcTemplate.query(anyString(), any(RowMapper.class), any()))
                .thenReturn(List.of(promptRow));
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any(), any()))
                .thenReturn(0);
        when(userLearningProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(weeklyRubricPromptBuilder.buildSystemMessage(any(), any(), any()))
                .thenReturn(new ChatMessage("system", "rubric"));
        when(weeklyRubricPromptBuilder.buildUserMessage(any(), any(), any(), any()))
                .thenReturn(new ChatMessage("user", "transcript"));
        when(quotaService.getSnapshot(anyLong(), any()))
                .thenReturn(new QuotaSnapshot("FREE", false, null, null,
                        2000L, 0L, 0L, 0L, 2000L, null, null));
        TierSpec dailySpec = new TierSpec(LlmTier.GRADING_DAILY, "openai/gpt-oss-120b",
                null, null, null, null, null, null, null, false, false);
        when(llmTierResolver.spec(LlmTier.GRADING_DAILY)).thenReturn(dailySpec);
        // Ném AiServiceException NGAY tại call LLM: hợp đồng tier đã chốt trước khi ném,
        // nên không cần mock cả đuôi persist/parse phía sau.
        when(openAiChatClient.chatCompletionForTier(any(), any(TierSpec.class), anyDouble(), any()))
                .thenThrow(new AiServiceException("AI bận"));

        var request = new WeeklySpeakingDtos.WeeklySubmissionRequest(
                1L, "Ich habe diese Woche viel Deutsch gelernt.", BigDecimal.TEN, "A2");
        assertThrows(AiServiceException.class, () -> service.submit(userId, request));

        ArgumentCaptor<TierSpec> spec = ArgumentCaptor.forClass(TierSpec.class);
        verify(openAiChatClient).chatCompletionForTier(any(), spec.capture(), anyDouble(), any());
        assertThat(spec.getValue().tier())
                .as("Chấm rubric bài nói tuần là luồng CHẤM thường nhật → GRADING_DAILY")
                .isEqualTo(LlmTier.GRADING_DAILY);
        assertThat(spec.getValue().model()).isEqualTo("openai/gpt-oss-120b");
    }
}
