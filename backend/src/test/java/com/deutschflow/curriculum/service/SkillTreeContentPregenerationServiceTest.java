package com.deutschflow.curriculum.service;

import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.ai.tier.TierSpec;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.curriculum.service.SkillTreeContentPregenerationService.PregenerateRequest;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.TokenUsage;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * F3.4b — sinh trước nội dung theo lô. Bất biến phải khoá: chỉ LẤP node rỗng (không ghi đè), một
 * node hỏng không làm sập cả lô, và đi đúng tầng CONTENT_BATCH chứ không phải tầng của đường unlock.
 */
@ExtendWith(MockitoExtension.class)
class SkillTreeContentPregenerationServiceTest {

    private static final String VALID_JSON = "{\"title\":{\"de\":\"Test\"},\"vocabulary\":[]}";

    @Mock JdbcTemplate jdbcTemplate;
    @Mock OpenAiChatClient chatClient;
    @Mock LlmTierResolver llmTierResolver;
    @Mock AiUsageLedgerService ledgerService;

    private SkillTreeContentPregenerationService service;

    private final TierSpec batchSpec = new TierSpec(LlmTier.CONTENT_BATCH,
            "accounts/fireworks/models/kimi-k2p6", null, null, null, null, null, null, null, false, false);

    @BeforeEach
    void setUp() {
        service = new SkillTreeContentPregenerationService(
                jdbcTemplate, chatClient, llmTierResolver, ledgerService, new ObjectMapper());
        lenient().when(llmTierResolver.spec(LlmTier.CONTENT_BATCH)).thenReturn(batchSpec);
    }

    private Map<String, Object> node(long id, String title) {
        Map<String, Object> n = new LinkedHashMap<>();
        n.put("id", id);
        n.put("title_de", title);
        n.put("industry", "IT");
        n.put("cefr_level", "A1");
        n.put("vocab_strategy", "LEHNWOERTER");
        n.put("industry_vocab_percent", 15);
        n.put("day_number", 8);
        n.put("grammar_points", "[\"Akkusativ\",\"Modalverben\"]");
        return n;
    }

    private void givenCandidates(List<Map<String, Object>> nodes) {
        when(jdbcTemplate.queryForList(contains("FROM skill_tree_nodes"), any(Object[].class)))
                .thenReturn(nodes);
    }

    private AiChatCompletionResult aiResult(String content) {
        return new AiChatCompletionResult(content, TokenUsage.exact(1200, 3100, 4300, 1100),
                "GROQ", "accounts/fireworks/models/kimi-k2p6");
    }

    @Test
    @DisplayName("dry-run: liệt kê ứng viên, KHÔNG gọi AI và KHÔNG ghi gì")
    void dryRunTouchesNothing() {
        givenCandidates(List.of(node(1L, "Hardware"), node(2L, "Software")));

        var result = service.run(9L, new PregenerateRequest(null, null, 10, true));

        assertThat(result.dryRun()).isTrue();
        assertThat(result.candidates()).isEqualTo(2);
        assertThat(result.generated()).isZero();
        assertThat(result.nodes()).extracting(n -> n.status()).containsOnly("CANDIDATE");
        verify(chatClient, never()).chatCompletionForTier(any(), any(), anyDouble(), anyInt());
        verify(jdbcTemplate, never()).update(anyString(), any(Object[].class));
    }

    @Test
    @DisplayName("sinh xong ghi cache + ledger; UPDATE có điều kiện content_json IS NULL")
    void generatesAndNeverOverwrites() {
        givenCandidates(List.of(node(1L, "Hardware")));
        when(chatClient.chatCompletionForTier(any(), eq(batchSpec), anyDouble(), anyInt()))
                .thenReturn(aiResult(VALID_JSON));
        when(jdbcTemplate.update(anyString(), any(), any(), any(), any())).thenReturn(1);

        var result = service.run(9L, new PregenerateRequest(null, null, null, false));

        assertThat(result.generated()).isEqualTo(1);
        assertThat(result.model()).isEqualTo("accounts/fireworks/models/kimi-k2p6");
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).update(sql.capture(), any(), any(), any(), any());
        // Bất biến quan trọng nhất: không bao giờ ghi đè nội dung đã có.
        assertThat(sql.getValue()).contains("content_json IS NULL");
        verify(ledgerService).record(eq(9L), eq("GROQ"), eq("accounts/fireworks/models/kimi-k2p6"),
                any(TokenUsage.class), eq("SKILL_TREE_PREGENERATE"), any(), any());
    }

    @Test
    @DisplayName("node bị người khác sinh xen giữa (UPDATE 0 dòng) → SKIPPED, không ghi ledger")
    void concurrentFillCountsAsSkipped() {
        givenCandidates(List.of(node(1L, "Hardware")));
        when(chatClient.chatCompletionForTier(any(), eq(batchSpec), anyDouble(), anyInt()))
                .thenReturn(aiResult(VALID_JSON));
        when(jdbcTemplate.update(anyString(), any(), any(), any(), any())).thenReturn(0);

        var result = service.run(9L, new PregenerateRequest(null, null, null, false));

        assertThat(result.skipped()).isEqualTo(1);
        assertThat(result.generated()).isZero();
        verify(ledgerService, never()).record(anyLong(), anyString(), anyString(),
                any(TokenUsage.class), anyString(), any(), any());
    }

    @Test
    @DisplayName("AI trả nội dung RỖNG → FAILED, tuyệt đối không ghi bài học trắng vào cache")
    void emptyAiContentIsFailureNotBlankLesson() {
        givenCandidates(List.of(node(1L, "Hardware")));
        when(chatClient.chatCompletionForTier(any(), eq(batchSpec), anyDouble(), anyInt()))
                .thenReturn(aiResult("   "));

        var result = service.run(9L, new PregenerateRequest(null, null, null, false));

        assertThat(result.failed()).isEqualTo(1);
        assertThat(result.nodes().get(0).detail()).contains("rỗng");
        verify(jdbcTemplate, never()).update(anyString(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("JSON hỏng ở node đầu KHÔNG làm sập lô — node sau vẫn sinh")
    void oneBadNodeDoesNotAbortBatch() {
        givenCandidates(List.of(node(1L, "Hardware"), node(2L, "Software")));
        when(chatClient.chatCompletionForTier(any(), eq(batchSpec), anyDouble(), anyInt()))
                .thenReturn(aiResult("{cụt json"))
                .thenReturn(aiResult(VALID_JSON));
        when(jdbcTemplate.update(anyString(), any(), any(), any(), any())).thenReturn(1);

        var result = service.run(9L, new PregenerateRequest(null, null, null, false));

        assertThat(result.failed()).isEqualTo(1);
        assertThat(result.generated()).isEqualTo(1);
        assertThat(result.nodes()).extracting(n -> n.status()).containsExactly("FAILED", "GENERATED");
    }

    @Test
    @DisplayName("đi tầng CONTENT_BATCH, KHÔNG dùng tầng CONTENT của đường unlock")
    void usesBatchTierNotRealtimeContentTier() {
        givenCandidates(List.of(node(1L, "Hardware")));
        when(chatClient.chatCompletionForTier(any(), eq(batchSpec), anyDouble(), anyInt()))
                .thenReturn(aiResult(VALID_JSON));
        when(jdbcTemplate.update(anyString(), any(), any(), any(), any())).thenReturn(1);

        service.run(9L, new PregenerateRequest(null, null, null, false));

        verify(llmTierResolver).spec(LlmTier.CONTENT_BATCH);
        verify(llmTierResolver, never()).spec(LlmTier.CONTENT);
    }

    @Test
    @DisplayName("limit bị kẹp trần 25 (mỗi node hàng chục giây), mặc định 5")
    void limitIsClamped() {
        givenCandidates(List.of());

        service.run(9L, new PregenerateRequest(null, null, 999, true));
        service.run(9L, new PregenerateRequest(null, null, null, true));

        ArgumentCaptor<Object[]> args = ArgumentCaptor.forClass(Object[].class);
        verify(jdbcTemplate, org.mockito.Mockito.times(2))
                .queryForList(contains("FROM skill_tree_nodes"), args.capture());
        assertThat(args.getAllValues().get(0)[0]).isEqualTo(25);
        assertThat(args.getAllValues().get(1)[0]).isEqualTo(5);
    }

    @Test
    @DisplayName("lọc theo ngành + trình độ đi vào WHERE, giữ đúng thứ tự tham số")
    void filtersAreApplied() {
        givenCandidates(List.of());

        service.run(9L, new PregenerateRequest("IT", "A2", 3, true));

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> args = ArgumentCaptor.forClass(Object[].class);
        verify(jdbcTemplate).queryForList(sql.capture(), args.capture());
        assertThat(sql.getValue()).contains("industry = ?").contains("cefr_level = ?");
        assertThat(args.getAllValues().get(0)).containsExactly("IT", "A2", 3);
    }

    @Test
    @DisplayName("chỉ nhắm node SATELLITE_LEAF còn rỗng và đang bật")
    void queryTargetsOnlyEmptyActiveSatelliteNodes() {
        givenCandidates(List.of());

        service.run(9L, new PregenerateRequest(null, null, null, true));

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).queryForList(sql.capture(), any(Object[].class));
        assertThat(sql.getValue())
                .contains("content_json IS NULL")
                .contains("is_active = TRUE")
                .contains("node_type = 'SATELLITE_LEAF'");
    }
}
