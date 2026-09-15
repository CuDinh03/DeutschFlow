package com.deutschflow.vocabulary.galerie;

import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.vocabulary.galerie.controller.GalerieAdminController;
import com.deutschflow.vocabulary.galerie.dto.GalerieConceptBatchResponse;
import com.deutschflow.vocabulary.galerie.service.GalerieConceptService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.when;

/**
 * 🪤 Tắt nhịp quét nền của hàng đợi AI cho RIÊNG lớp này.
 *
 * <p>{@code AiJobWorker.processPendingJobs} chạy mỗi 2 giây suốt integration test, nhặt job PENDING
 * còn tồn của ca test trước và gọi vào cùng mock AI trên LUỒNG NỀN. Nếu nó chen đúng lúc
 * {@code @BeforeEach} đang đặt stub thì Mockito gắn stub vào lời gọi nền (tham số cụ thể của ca cũ)
 * thay vì vào các matcher — {@code getStubbings()} vẫn trả 1 nhưng mọi lời gọi của ca đang chạy đều
 * không khớp và trả {@code null}, rơi hết xuống câu dự phòng.
 *
 * <p>Đo 15/09/2026: trước khi tắt, lớp này đỏ ~1/2 số lượt và khi đỏ thì đỏ TOÀN BỘ lời gọi AI
 * (14/14). Sau khi tắt: 8/8 lượt xanh, 0 lần rơi dự phòng.
 *
 * <p>⚠️ Tắt theo LỚP chứ không tắt toàn cục: {@code AiJobWorkerClaimIntegrationTest},
 * {@code StaleAiJobGuardIntegrationTest} và {@code ExamGradingFailurePathIntegrationTest} CẦN nhịp
 * quét đó — tắt toàn cục làm chúng chờ hết giờ rồi đỏ.
 */
@org.springframework.test.context.TestPropertySource(properties = "app.ai-jobs.scheduled-enabled=false")
/**
 * SQL Galerie chạy trên PostgreSQL THẬT — khoá lại lỗi prod ERR-1..3 (16/08): unit test mock
 * JdbcTemplate không chạm tới SQL nên đã che việc {@code words} KHÔNG có cột {@code meaning}/
 * {@code gender} (nghĩa ở {@code word_translations} vi→en, gender ở {@code nouns}).
 * LLM được mock — IT này chứng minh SQL + persist, không chứng minh chất lượng concept.
 */
@SpringBootTest
class GalerieConceptSchemaIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String CLEAN = "__galerie_it_clean__";
    private static final String STUFFED = "__galerie_it_stuffed__";
    private static final List<String> FIXTURES = List.of(CLEAN, STUFFED);

    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired GalerieConceptService conceptService;
    @Autowired GalerieAdminController controller;

    @MockBean OpenAiChatClient chatClient;

    private long cleanId;
    private long stuffedId;

    @BeforeEach
    void seed() {
        cleanup();
        cleanId = insertWord(CLEAN);
        insertTranslation(cleanId, "vi", "quả táo kiểm thử");
        stuffedId = insertWord(STUFFED);
        // Nghĩa nhồi trích dẫn (data bẩn 16/08) — dài quá trần MAX_MEANING_LENGTH ⇒ phải bị lọc
        insertTranslation(stuffedId, "vi", "nghĩa nhồi ".repeat(30));
    }

    @AfterEach
    void cleanup() {
        for (String lemma : FIXTURES) {
            jdbcTemplate.update("DELETE FROM words WHERE base_form = ?", lemma);
        }
    }

    private long insertWord(String lemma) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO words (dtype, base_form, cefr_level, created_at, updated_at)
                VALUES ('Word', ?, 'A1', NOW(), NOW()) RETURNING id
                """, Long.class, lemma);
    }

    private void insertTranslation(long wordId, String locale, String meaning) {
        jdbcTemplate.update("INSERT INTO word_translations (word_id, locale, meaning) VALUES (?, ?, ?)",
                wordId, locale, meaning);
    }

    @Test
    @DisplayName("countMissing chạy được trên schema thật; từ sạch được đếm, nghĩa nhồi bị lọc")
    void countMissing_runsOnRealSchema_andFiltersDirtyMeaning() {
        int total = conceptService.countMissing(null);
        assertThat(total).isGreaterThanOrEqualTo(1);

        // Từ nghĩa-nhồi không được vào batch: xoá từ sạch đi thì count giảm đúng 1 so với trước
        jdbcTemplate.update("DELETE FROM words WHERE id = ?", cleanId);
        assertThat(conceptService.countMissing(null)).isEqualTo(total - 1);
    }

    @Test
    // Controller có @PreAuthorize — gọi trực tiếp trong IT cần Authentication giả
    // (gotcha đã ghi: plain @SpringBootTest → AuthenticationCredentialsNotFound)
    @WithMockUser(roles = "ADMIN")
    @DisplayName("generateForWordIds: đọc nghĩa từ word_translations, persist family/concept/CONCEPT_READY; overview đọc lại được")
    void generateForWordIds_persistsAndOverviewReads() {
        // 🪤 doAnswer/doReturn chứ KHÔNG when(mock.gọi(...)) — xem chú thích trong
        // ExamSessionFlowIntegrationTest: dạng sau gọi thật vào mock và có thể chen với lời gọi nền.
        doReturn(new AiChatCompletionResult(
                "{\"family\":\"OBJEKT\",\"concept\":\"One expressive test apple.\"}",
                null, "test", "test-model"))
                .when(chatClient).chatCompletionForTier(anyList(), any(), anyDouble(), anyInt(), anyBoolean());

        GalerieConceptBatchResponse response =
                conceptService.generateForWordIds(List.of(cleanId, stuffedId), null);

        // Từ nghĩa-nhồi bị lọc ngay từ SELECT nên requested chỉ còn 1
        assertThat(response.requested()).isEqualTo(1);
        assertThat(response.succeeded()).isEqualTo(1);

        Map<String, Object> row = jdbcTemplate.queryForMap(
                "SELECT image_family, image_concept, image_status FROM words WHERE id = ?", cleanId);
        assertThat(row.get("image_family")).isEqualTo("OBJEKT");
        assertThat(row.get("image_concept")).isEqualTo("One expressive test apple.");
        assertThat(row.get("image_status")).isEqualTo("CONCEPT_READY");

        List<Map<String, Object>> overview = controller.overview("CONCEPT_READY", 200, 0).getBody();
        assertThat(overview).isNotNull();
        assertThat(overview.stream().anyMatch(r -> CLEAN.equals(r.get("base_form"))
                && "quả táo kiểm thử".equals(r.get("meaning")))).isTrue();
    }
}
