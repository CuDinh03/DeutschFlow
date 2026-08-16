package com.deutschflow.vocabulary.galerie.service;

import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.ai.tier.TierSpec;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.TokenUsage;
import com.deutschflow.vocabulary.galerie.GalerieFamily;
import com.deutschflow.vocabulary.galerie.GaleriePromptFactory;
import com.deutschflow.vocabulary.galerie.dto.GalerieConceptBatchResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GalerieConceptServiceTest {

    @Mock private JdbcTemplate jdbcTemplate;
    @Mock private OpenAiChatClient chatClient;
    @Mock private LlmTierResolver llmTierResolver;
    @Mock private AiUsageLedgerService aiUsageLedgerService;

    private GalerieConceptService service;

    private static final Map<String, Object> APFEL_ROW = Map.of(
            "id", 42L,
            "base_form", "Apfel",
            "gender", "der",
            "dtype", "NOUN",
            "meaning", "quả táo",
            "cefr_level", "A1");

    @BeforeEach
    void setUp() {
        service = new GalerieConceptService(jdbcTemplate, chatClient, llmTierResolver,
                new GaleriePromptFactory(), aiUsageLedgerService, new ObjectMapper());
        lenient().when(llmTierResolver.spec(any())).thenReturn(new TierSpec(
                com.deutschflow.ai.tier.LlmTier.BATCH, "test-model",
                null, null, null, null, null, null, null, false, false));
    }

    @Test
    @DisplayName("happy path: LLM trả JSON hợp lệ → UPDATE family/concept/CONCEPT_READY + ghi ledger")
    void generateForMissing_persistsParsedConcept() {
        when(jdbcTemplate.queryForList(anyString(), any(Object[].class)))
                .thenReturn(List.of(APFEL_ROW));
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any(Object[].class)))
                .thenReturn(7);
        TokenUsage usage = new TokenUsage(100, 50, 150, false, 0);
        when(chatClient.chatCompletionForTier(anyList(), any(), anyDouble(), anyInt(), anyBoolean()))
                .thenReturn(new AiChatCompletionResult(
                        "{\"family\":\"OBJEKT\",\"concept\":\"One expressive brick-red apple.\"}",
                        usage, "fireworks", "test-model"));

        GalerieConceptBatchResponse response = service.generateForMissing(10, "A1", 1L);

        assertThat(response.requested()).isEqualTo(1);
        assertThat(response.succeeded()).isEqualTo(1);
        assertThat(response.failed()).isZero();
        assertThat(response.remaining()).isEqualTo(7);
        verify(jdbcTemplate).update(contains("SET image_family = ?"),
                eq("OBJEKT"), eq("One expressive brick-red apple."),
                eq(GalerieConceptService.STATUS_CONCEPT_READY), eq(42L));
        verify(aiUsageLedgerService).record(eq(1L), eq("fireworks"), eq("test-model"),
                eq(usage), eq(GalerieConceptService.FEATURE), eq(null), eq(null));
    }

    @Test
    @DisplayName("LLM trả rác → không UPDATE gì (concept vẫn NULL để lượt sau retry), lỗi vào failures")
    void generateForMissing_llmGarbage_doesNotPersist() {
        when(jdbcTemplate.queryForList(anyString(), any(Object[].class)))
                .thenReturn(List.of(APFEL_ROW));
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any(Object[].class)))
                .thenReturn(8);
        when(chatClient.chatCompletionForTier(anyList(), any(), anyDouble(), anyInt(), anyBoolean()))
                .thenReturn(new AiChatCompletionResult("not json at all", null, "fireworks", "m"));

        GalerieConceptBatchResponse response = service.generateForMissing(10, null, 1L);

        assertThat(response.succeeded()).isZero();
        assertThat(response.failed()).isEqualTo(1);
        assertThat(response.failures()).hasSize(1);
        assertThat(response.failures().get(0).wordId()).isEqualTo(42L);
        verify(jdbcTemplate, never()).update(anyString(), any(Object[].class));
    }

    @Test
    @DisplayName("một từ lỗi không giết cả batch — từ sau vẫn được xử lý")
    void generateForMissing_oneFailureDoesNotAbortBatch() {
        Map<String, Object> haus = Map.of("id", 43L, "base_form", "Haus", "gender", "das",
                "dtype", "NOUN", "meaning", "ngôi nhà", "cefr_level", "A1");
        when(jdbcTemplate.queryForList(anyString(), any(Object[].class)))
                .thenReturn(List.of(APFEL_ROW, haus));
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any(Object[].class)))
                .thenReturn(0);
        when(chatClient.chatCompletionForTier(anyList(), any(), anyDouble(), anyInt(), anyBoolean()))
                .thenReturn(new AiChatCompletionResult("broken", null, "fireworks", "m"))
                .thenReturn(new AiChatCompletionResult(
                        "{\"family\":\"ORT\",\"concept\":\"One warm simplified house.\"}",
                        null, "fireworks", "m"));

        GalerieConceptBatchResponse response = service.generateForMissing(10, null, null);

        assertThat(response.succeeded()).isEqualTo(1);
        assertThat(response.failed()).isEqualTo(1);
        verify(jdbcTemplate).update(contains("SET image_family = ?"),
                eq("ORT"), eq("One warm simplified house."),
                eq(GalerieConceptService.STATUS_CONCEPT_READY), eq(43L));
    }

    @Test
    @DisplayName("generateForWordIds với danh sách rỗng → không gọi LLM")
    void generateForWordIds_emptyList_noLlmCall() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any(Object[].class)))
                .thenReturn(3);

        GalerieConceptBatchResponse response = service.generateForWordIds(List.of(), 1L);

        assertThat(response.requested()).isZero();
        verify(chatClient, never()).chatCompletionForTier(anyList(), any(), anyDouble(), anyInt(), anyBoolean());
    }

    @Test
    @DisplayName("parse: family lạ / concept rỗng / concept dài bất thường đều bị từ chối")
    void parse_rejectsInvalidPayloads() {
        assertThatThrownBy(() -> service.parse("{\"family\":\"LANDSCAPE\",\"concept\":\"x\"}"))
                .hasMessageContaining("family");
        assertThatThrownBy(() -> service.parse("{\"family\":\"OBJEKT\",\"concept\":\"\"}"))
                .hasMessageContaining("concept");
        assertThatThrownBy(() -> service.parse("{\"family\":\"OBJEKT\",\"concept\":\"" + "x".repeat(700) + "\"}"))
                .hasMessageContaining("dài bất thường");
    }

    @Test
    @DisplayName("parse: biến thể family có dấu ('GEFÜHL & IDEE') vẫn nhận, whitespace concept được ép phẳng")
    void parse_normalizesFamilyAndConcept() {
        GalerieConceptService.ParsedConcept parsed = service.parse(
                "{\"family\":\"GEFÜHL & IDEE\",\"concept\":\"A gold clock\\n  floating in cream space.\"}");

        assertThat(parsed.family()).isEqualTo(GalerieFamily.GEFUEHL_IDEE);
        assertThat(parsed.concept()).isEqualTo("A gold clock floating in cream space.");
    }
}
