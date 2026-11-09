package com.deutschflow.grammar.service;

import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.ai.tier.TierSpec;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.exception.RateLimitExceededException;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.common.quota.QuotaExceededException;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.grammar.dto.PracticeDtos;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.speaking.AiRateLimiterService;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.TokenUsage;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * "Hỏi AI về câu này" (B3): bản đã lưu không gọi AI, không trừ quota; chưa có thì đi đủ giới hạn lượt →
 * quota → pool → AI → sổ token → lưu; lượt của người khác 404, chưa nộp 409, hết quota 429.
 */
@DisplayName("ExamItemAiService — hỏi AI về một câu đã nộp")
class ExamItemAiServiceTest {

    private static final long UID = 42L;
    private static final TierSpec EXPLAIN = new TierSpec(LlmTier.EXPLAIN, "explain-model", null, null, null, null, null, null, null, false, false);

    private final MockExamPracticeService practice = mock(MockExamPracticeService.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final OpenAiChatClient chat = mock(OpenAiChatClient.class);
    private final LlmTierResolver tiers = mock(LlmTierResolver.class);
    private final QuotaService quota = mock(QuotaService.class);
    private final OrgPoolGuard orgPool = mock(OrgPoolGuard.class);
    private final AiUsageLedgerService ledger = mock(AiUsageLedgerService.class);
    private final AiRateLimiterService limiter = mock(AiRateLimiterService.class);
    private final ExamItemAiService service =
            new ExamItemAiService(practice, jdbc, chat, tiers, quota, orgPool, ledger, limiter);
    private final User user = User.builder().id(UID).email("a@test.local").role(User.Role.STUDENT).build();

    private static final Map<String, Object> TEIL = Map.of(
            "type", "MULTIPLE_CHOICE",
            "context", "Anna fährt am Montag mit dem Zug nach Berlin.",
            "items", List.of(Map.of(
                    "id", "LV2-6", "question", "Wann fährt Anna?",
                    "options", Map.of("a", "Am Montag", "b", "Am Dienstag", "c", "Am Mittwoch"),
                    "correct", "a", "explanation_vi", "Bài ghi rõ thứ Hai.")));

    private final MockExamPracticeService.ReviewContext ctx =
            new MockExamPracticeService.ReviewContext(7L, "LESEN-2", TEIL, Map.of(), Map.of("LV2-6", "b"));

    @BeforeEach
    void setUp() {
        when(tiers.spec(LlmTier.EXPLAIN)).thenReturn(EXPLAIN);
        when(limiter.allow(any(), anyLong())).thenReturn(true);
        when(practice.attemptReview(user, 9L, "LESEN-2")).thenReturn(ctx);
        when(practice.practiceReview(user, 7L, "LESEN-2")).thenReturn(ctx);
    }

    @SuppressWarnings("unchecked")
    private void cache(List<String> rows) {
        when(jdbc.queryForList(anyString(), eq(String.class), any(Object[].class))).thenReturn(rows);
    }

    private void aiAnswers(String content) {
        when(chat.chatCompletionForTier(any(), any(), anyDouble(), any(), eq(false)))
                .thenReturn(new AiChatCompletionResult(content, new TokenUsage(800, 120, 920, false, 0), "groq", "explain-model"));
    }

    @Test
    @DisplayName("Đã có bản lưu ⇒ trả ngay, không gọi AI, không giới hạn lượt, không trừ quota")
    void cacheHit_noLlmNoQuota() {
        cache(List.of("Đáp án a vì bài ghi „am Montag“."));

        PracticeDtos.ItemAiAnswer a = service.askAttempt(user, 9L, "LESEN-2", "LV2-6", "vi");

        assertThat(a.cached()).isTrue();
        assertThat(a.answer()).contains("am Montag");
        assertThat(a.locale()).isEqualTo("vi");
        verifyNoInteractions(chat, quota, orgPool, ledger, limiter);
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    @DisplayName("Chưa có ⇒ quota + pool + AI tầng EXPLAIN (văn bản thường) + sổ token + lưu bộ nhớ đệm")
    void cacheMiss_callsAiOnceAndStores() {
        cache(List.of());
        aiAnswers("<think>nháp</think>Bạn chọn **b** nhưng bài nói „am Montag“.");

        PracticeDtos.ItemAiAnswer a = service.askPractice(user, 7L, "LESEN-2", "LV2-6", "vi-VN");

        assertThat(a.cached()).isFalse();
        assertThat(a.answer()).isEqualTo("Bạn chọn b nhưng bài nói „am Montag“.");
        verify(limiter).allow(AiRateLimiterService.Bucket.TEXT, UID);
        verify(quota).assertAllowed(eq(UID), any(), eq(ExamItemAiService.ESTIMATED_TOKENS));
        verify(orgPool).assertOrgPoolAvailable(UID, ExamItemAiService.ESTIMATED_TOKENS);
        verify(ledger).record(eq(UID), eq("groq"), eq("explain-model"), any(TokenUsage.class),
                eq(ExamItemAiService.FEATURE), any(), any());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ChatMessage>> messages = ArgumentCaptor.forClass(List.class);
        verify(chat).chatCompletionForTier(messages.capture(), eq(EXPLAIN), anyDouble(), any(), eq(false));
        String userMsg = messages.getValue().get(1).content();
        assertThat(userMsg).contains("Anna fährt am Montag", "Wann fährt Anna?", "Antwort des Lernenden: b",
                "Richtige Antwort: a", "Bài ghi rõ thứ Hai.");
        assertThat(messages.getValue().get(0).content()).contains("Vietnamese");

        ArgumentCaptor<Object[]> insert = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).update(anyString(), insert.capture());
        Object[] args = insert.getValue();
        assertThat(args[0]).isEqualTo(7L);
        assertThat(args[2]).isEqualTo("LV2-6");
        assertThat(args[3]).isEqualTo("b");
        assertThat(args[4]).isEqualTo("vi");
        assertThat(args[5]).isEqualTo(ExamItemAiService.sha256(userMsg));
    }

    @Test
    @DisplayName("Hết quota ⇒ 429 (QuotaExceededException), không gọi AI, không lưu")
    void quotaExceeded_noAiCall() {
        cache(List.of());
        doThrow(new QuotaExceededException("Hết lượt AI", null)).when(quota).assertAllowed(anyLong(), any(), anyLong());

        assertThatThrownBy(() -> service.askAttempt(user, 9L, "LESEN-2", "LV2-6", "vi"))
                .isInstanceOf(QuotaExceededException.class);
        verifyNoInteractions(chat, ledger);
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    @DisplayName("Hỏi dồn dập ⇒ 429 giới hạn lượt, chưa đụng quota")
    void rateLimited() {
        cache(List.of());
        when(limiter.allow(any(), anyLong())).thenReturn(false);
        when(limiter.retryAfterSeconds(any(), anyLong())).thenReturn(30);

        assertThatThrownBy(() -> service.askAttempt(user, 9L, "LESEN-2", "LV2-6", "vi"))
                .isInstanceOf(RateLimitExceededException.class);
        verifyNoInteractions(chat, quota);
    }

    @Test
    @DisplayName("Lượt của người khác ⇒ 404; chưa nộp ⇒ 409 — đều không đụng bộ nhớ đệm hay AI")
    void ownershipAndSubmitGuards() {
        when(practice.attemptReview(user, 99L, "LESEN-2")).thenThrow(new NotFoundException("x"));
        when(practice.practiceReview(user, 8L, "LESEN-2")).thenThrow(new ConflictException("x"));

        assertThatThrownBy(() -> service.askAttempt(user, 99L, "LESEN-2", "LV2-6", "vi"))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.askPractice(user, 8L, "LESEN-2", "LV2-6", "vi"))
                .isInstanceOf(ConflictException.class);
        verifyNoInteractions(jdbc, chat, quota);
    }

    @Test
    @DisplayName("Câu không có trong Teil ⇒ 404")
    void unknownItem() {
        assertThatThrownBy(() -> service.askAttempt(user, 9L, "LESEN-2", "NOPE", "vi"))
                .isInstanceOf(NotFoundException.class);
        verifyNoInteractions(chat, quota);
    }

    @Test
    @DisplayName("AI trả rỗng ⇒ lỗi dịch vụ, không lưu bản rỗng (token vẫn ghi sổ)")
    void emptyAnswerNotCached() {
        cache(List.of());
        aiAnswers("   ");

        assertThatThrownBy(() -> service.askAttempt(user, 9L, "LESEN-2", "LV2-6", "en"))
                .isInstanceOf(com.deutschflow.speaking.exception.AiServiceException.class);
        verify(ledger).record(anyLong(), anyString(), anyString(), any(TokenUsage.class), anyString(), any(), any());
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    @DisplayName("Khoá đệm: cùng ngữ cảnh ⇒ cùng hash; đổi đáp án đã chọn ⇒ ngữ cảnh khác")
    void hashFollowsChosenAnswer() {
        var items = PracticeAnalysis.analyse("LESEN-2", TEIL, Map.of(), Map.of("LV2-6", "b")).items();
        var other = PracticeAnalysis.analyse("LESEN-2", TEIL, Map.of(), Map.of("LV2-6", "c")).items();
        @SuppressWarnings("unchecked")
        Map<String, Object> raw = (Map<String, Object>) ((List<?>) TEIL.get("items")).get(0);
        String a1 = ExamItemAiPrompt.context("LESEN-2", TEIL, raw, items.get(0));
        String a2 = ExamItemAiPrompt.context("LESEN-2", TEIL, raw, items.get(0));
        String b = ExamItemAiPrompt.context("LESEN-2", TEIL, raw, other.get(0));
        assertThat(ExamItemAiService.sha256(a1)).isEqualTo(ExamItemAiService.sha256(a2)).hasSize(64);
        assertThat(ExamItemAiService.sha256(a1)).isNotEqualTo(ExamItemAiService.sha256(b));
    }
}
