package com.deutschflow.curriculum.service;

import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.ai.tier.TierSpec;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.TokenUsage;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * B1.9 + B1.10 — hai luồng ĐÁNH GIÁ per-user trong {@code SkillTreeService} phải đi tầng chấm,
 * không phải tầng sinh nội dung.
 *
 * <p>Trước đây cả hai gọi {@code spec(CONTENT)} dù chúng không sinh gì để cache: chấm phát âm và
 * báo cáo cuối phiên phỏng vấn đều là phản hồi cho MỘT học viên. Hệ quả hai chiều: nâng model cho
 * nội dung sư phạm thì kéo theo hai luồng này, còn ngân sách 1024 token của chúng lại khoá trần
 * cho cả tier CONTENT (chính chỗ làm Kimi K2.6 trả rỗng khi thử flip, đo 09/08).
 *
 * <p>Cùng họ với 6 mis-route đã sửa ở B1.1–B1.8 và cùng bài học: test cũ hay mã hoá chính hành vi
 * sai, nên hợp đồng phải nói rõ "tầng nào", không phải "model nào".
 */
@ExtendWith(MockitoExtension.class)
class SkillTreeEvalTierTest {

    @Mock JdbcTemplate jdbcTemplate;
    @Mock OpenAiChatClient chatClient;
    @Mock LlmTierResolver llmTierResolver;
    @Mock AiUsageLedgerService aiUsageLedgerService;
    @Spy ObjectMapper objectMapper = new ObjectMapper();
    @Mock org.springframework.transaction.support.TransactionTemplate transactionTemplate;
    @Mock com.deutschflow.gamification.service.XpService xpService;
    @Mock com.deutschflow.common.async.AsyncJobService asyncJobService;
    @Mock PracticeNodeService practiceNodeService;
    @Mock com.deutschflow.srs.service.SrsVocabScheduler srsVocabScheduler;
    @Mock com.deutschflow.progress.service.PhaseEngineService phaseEngineService;
    @Mock QuotaService quotaService;
    @Mock OrgPoolGuard orgPoolGuard;
    @Mock java.util.concurrent.Executor aiExecutor;

    @InjectMocks SkillTreeService service;

    private final TierSpec gradingDaily = new TierSpec(LlmTier.GRADING_DAILY,
            "openai/gpt-oss-120b", null, null, null, null, null, null, "low", false, false);

    @BeforeEach
    void stubTier() {
        lenient().when(llmTierResolver.spec(LlmTier.GRADING_DAILY)).thenReturn(gradingDaily);
    }

    private AiChatCompletionResult result(String json) {
        return new AiChatCompletionResult(json, TokenUsage.exact(400, 300, 700, 380),
                "GROQ", "openai/gpt-oss-120b");
    }

    @Test
    @DisplayName("B1.9 chấm phát âm đi tầng GRADING_DAILY, KHÔNG dùng tầng CONTENT")
    void pronunciationEvalUsesGradingDailyTier() {
        when(chatClient.chatCompletionForTier(any(), eq(gradingDaily), anyDouble(), anyInt()))
                .thenReturn(result("{\"tips\":[\"Chú ý âm r cuối\",\"Kéo dài nguyên âm ah\"]}"));

        Map<String, Object> out = service.evaluatePronunciation(
                7L, "Ich bin gestern gefahren", "Ich war mongen kaufen", List.of("r"));

        assertThat(out).containsKey("tips");
        verify(llmTierResolver).spec(LlmTier.GRADING_DAILY);
        verify(llmTierResolver, never()).spec(LlmTier.CONTENT);
        verify(aiUsageLedgerService).record(eq(7L), anyString(), anyString(),
                any(TokenUsage.class), eq("PRONUNCIATION_EVAL"), any(), any());
    }

    @Test
    @DisplayName("B1.10 báo cáo phỏng vấn đi tầng GRADING_DAILY, KHÔNG dùng tầng CONTENT")
    void interviewReportUsesGradingDailyTier() {
        Map<String, Object> msg = new LinkedHashMap<>();
        msg.put("role", "user");
        msg.put("content", "Ich habe drei Jahre gearbeitet.");
        when(jdbcTemplate.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(msg));
        when(chatClient.chatCompletionForTier(any(), eq(gradingDaily), anyDouble(), anyInt()))
                .thenReturn(result("""
                        {"overallScore":72,"fluencyScore":70,"grammarScore":65,"vocabularyScore":75,
                         "strengths":["Trả lời đủ ý"],"improvements":["Chia động từ"],
                         "summaryVi":"Khá ổn."}"""));

        Map<String, Object> out = service.generateInterviewReport(7L, 11L);

        assertThat(out).containsEntry("overallScore", 72);
        verify(llmTierResolver).spec(LlmTier.GRADING_DAILY);
        verify(llmTierResolver, never()).spec(LlmTier.CONTENT);
        verify(aiUsageLedgerService).record(eq(7L), anyString(), anyString(),
                any(TokenUsage.class), eq("INTERVIEW_REPORT"), any(), any());
    }

    @Test
    @DisplayName("phiên rỗng: trả báo cáo mặc định, KHÔNG gọi AI lẫn quota")
    void emptySessionSkipsAiEntirely() {
        when(jdbcTemplate.queryForList(anyString(), any(Object[].class))).thenReturn(List.of());

        Map<String, Object> out = service.generateInterviewReport(7L, 11L);

        assertThat(out).containsEntry("overallScore", 0);
        verify(chatClient, never()).chatCompletionForTier(any(), any(), anyDouble(), anyInt());
        verify(quotaService, never()).assertAllowed(anyLongArg(), any(), anyLongArg());
    }

    private static long anyLongArg() {
        return org.mockito.ArgumentMatchers.anyLong();
    }
}
