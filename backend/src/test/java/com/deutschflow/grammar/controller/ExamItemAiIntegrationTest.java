package com.deutschflow.grammar.controller;

import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.ai.tier.TierSpec;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.grammar.dto.PracticeDtos;
import com.deutschflow.grammar.service.ExamItemAiService;
import com.deutschflow.grammar.service.MockExamDraftService;
import com.deutschflow.grammar.service.MockExamPracticeService;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.speaking.AiRateLimiterService;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.TokenUsage;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * B3 "Nâng phòng thi" trên PostgreSQL thật (V374): ghi chú "vì sao tôi chọn" lưu cùng nháp/nộp, câu đánh
 * dấu lưu cùng nháp thi thử, và "Hỏi AI về câu này" — bộ nhớ đệm trong {@code exam_item_ai_explanations}
 * (hỏi lần hai không gọi AI, không trừ quota), endpoint POST với quyền chủ lượt (404) và chỉ sau khi nộp (409).
 *
 * <p>Service AI dựng tay với bản giả của AI/quota (không {@code @MockBean}: mỗi tổ hợp là một Spring context
 * + pool kết nối mới, CI từng vượt {@code max_connections}). Endpoint thật chỉ được gọi ở các nhánh không
 * cần AI: bản đã lưu, 404, 409. Đề riêng cấp C2 (không có bộ đề trả phí) để không đụng đề seed.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Hỏi AI về câu này + ghi chú + đánh dấu (V374) trên Postgres")
class ExamItemAiIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final long OWNER = 990_373L;
    private static final long OTHER = 990_374L;
    private static final String TITLE = "Đề C2 hỏi AI (B3)";
    private static final String SECTIONS = """
            {"sections":[{"name":"LESEN","teile":[{"teil":2,"type":"MULTIPLE_CHOICE",
              "context":"Anna fährt am Montag mit dem Zug nach Berlin.",
              "items":[{"id":"LV2-6","question":"Wann fährt Anna?",
                        "options":{"a":"Am Montag","b":"Am Dienstag","c":"Am Mittwoch"},
                        "correct":"a","explanation_vi":"Bài ghi rõ thứ Hai."},
                       {"id":"LV2-7","question":"Womit fährt Anna?",
                        "options":{"a":"Mit dem Bus","b":"Mit dem Zug","c":"Mit dem Auto"},
                        "correct":"b","explanation_vi":"Bài nói đi tàu."}]}]}]}
            """;

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private UserRepository users;
    @Autowired private MockExamPracticeService practice;
    @Autowired private MockExamDraftService drafts;

    private final OpenAiChatClient chat = mock(OpenAiChatClient.class);
    private final QuotaService quota = mock(QuotaService.class);
    private final AiUsageLedgerService ledger = mock(AiUsageLedgerService.class);
    private final AiRateLimiterService limiter = mock(AiRateLimiterService.class);
    private final LlmTierResolver tiers = mock(LlmTierResolver.class);

    private ExamItemAiService ai;
    private User owner;
    private User other;
    private long examId;

    @BeforeEach
    void setUp() {
        insertUser(OWNER, "ADMIN");   // ADMIN luôn qua cờ luyện đề — không đổi system_config dùng chung
        insertUser(OTHER, "STUDENT");
        owner = users.findById(OWNER).orElseThrow();
        other = users.findById(OTHER).orElseThrow();
        examId = jdbc.queryForObject("""
                INSERT INTO mock_exams (cefr_level, exam_format, title, sections_json, is_active, total_points, pass_points)
                VALUES ('C2', 'TELC', ?, ?::jsonb, TRUE, 100, 60) RETURNING id
                """, Long.class, TITLE, SECTIONS);

        when(limiter.allow(any(), anyLong())).thenReturn(true);
        when(tiers.spec(LlmTier.EXPLAIN)).thenReturn(new TierSpec(LlmTier.EXPLAIN, "explain-model",
                null, null, null, null, null, null, null, false, false));
        when(chat.chatCompletionForTier(any(), any(), anyDouble(), any(), eq(false)))
                .thenReturn(new AiChatCompletionResult("Đáp án a vì bài viết „am Montag“.",
                        new TokenUsage(700, 90, 790, false, 0), "groq", "explain-model"));
        ai = new ExamItemAiService(practice, jdbc, chat, tiers, quota, mock(OrgPoolGuard.class), ledger, limiter);
    }

    @AfterEach
    void tearDown() {
        jdbc.update("DELETE FROM mock_exam_attempts WHERE user_id IN (?, ?)", OWNER, OTHER);
        jdbc.update("DELETE FROM mock_exams WHERE cefr_level = 'C2' AND title = ?", TITLE); // xoá theo: tiến độ, bộ đệm
        jdbc.update("DELETE FROM users WHERE id IN (?, ?)", OWNER, OTHER);
    }

    @Test
    @DisplayName("Migration V374: cột ghi chú, cột câu đánh dấu, bảng bộ nhớ đệm có khoá duy nhất")
    void migrationShape() {
        assertThat(column("mock_exam_practice_progress", "notes_json")).isEqualTo("jsonb");
        assertThat(column("mock_exam_attempts", "draft_flags_json")).isEqualTo("jsonb");
        assertThat(column("exam_item_ai_explanations", "content_hash")).isNotNull();
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM pg_constraint WHERE conname = 'uq_exam_item_ai_explanation'
                """, Integer.class)).isEqualTo(1);
    }

    @Test
    @DisplayName("Luyện Teil: ghi chú lưu cùng nháp và nộp; hỏi AI trước khi nộp 409; sau khi nộp gọi AI một lần, lần hai lấy bộ đệm")
    void practiceFlow() throws Exception {
        PracticeDtos.Progress draft = practice.saveDraft(owner, examId, "LESEN-2", Map.of("LV2-6", "b"), 30,
                Map.of("LV2-6", "  Mình tưởng „Dienstag“  ", "NOPE", "bỏ"));
        assertThat(draft.notes()).containsExactly(Map.entry("LV2-6", "Mình tưởng „Dienstag“"));
        // Lưu nháp không kèm ghi chú (client cũ) ⇒ ghi chú giữ nguyên.
        assertThat(practice.saveDraft(owner, examId, "LESEN-2", Map.of("LV2-6", "b"), 40).notes()).containsKey("LV2-6");

        assertThatThrownBy(() -> ai.askPractice(owner, examId, "LESEN-2", "LV2-6", "vi")).isInstanceOf(ConflictException.class);
        mockMvc.perform(post("/api/mock-exams/practice/{examId}/teile/LESEN-2/items/LV2-6/ask-ai", examId)
                        .with(user(owner)).contentType(MediaType.APPLICATION_JSON).content("{\"locale\":\"vi\"}"))
                .andExpect(status().isConflict());

        PracticeDtos.Progress checked = practice.check(owner, examId, "LESEN-2", Map.of("LV2-6", "b", "LV2-7", "b"), 60,
                Map.of("LV2-6", "Mình tưởng „Dienstag“"));
        assertThat(checked.checked()).isTrue();
        assertThat(checked.notes()).containsEntry("LV2-6", "Mình tưởng „Dienstag“");
        assertThat(practice.overview(owner, examId).teile().get(0).progress().notes()).containsKey("LV2-6");

        PracticeDtos.ItemAiAnswer first = ai.askPractice(owner, examId, "LESEN-2", "LV2-6", "vi");
        PracticeDtos.ItemAiAnswer again = ai.askPractice(owner, examId, "LESEN-2", "LV2-6", "vi");
        assertThat(first.cached()).isFalse();
        assertThat(again.cached()).isTrue();
        assertThat(again.answer()).isEqualTo(first.answer());
        verify(chat, times(1)).chatCompletionForTier(any(), any(), anyDouble(), any(), eq(false));
        verify(quota, times(1)).assertAllowed(eq(OWNER), any(Instant.class), anyLong());

        // Câu làm đúng cũng hỏi được (khoá đệm riêng theo đáp án đã chọn).
        assertThat(ai.askPractice(owner, examId, "LESEN-2", "LV2-7", "vi").cached()).isFalse();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM exam_item_ai_explanations WHERE exam_id = ?",
                Integer.class, examId)).isEqualTo(2);

        // Endpoint thật: bản đã lưu ⇒ 200, cached = true, không cần AI.
        mockMvc.perform(post("/api/mock-exams/practice/{examId}/teile/LESEN-2/items/LV2-6/ask-ai", examId)
                        .with(user(owner)).contentType(MediaType.APPLICATION_JSON).content("{\"locale\":\"vi\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cached").value(true))
                .andExpect(jsonPath("$.itemId").value("LV2-6"))
                .andExpect(jsonPath("$.answer").value(first.answer()));
    }

    @Test
    @DisplayName("Thi thử: chủ lượt đã nộp ⇒ hỏi được và bộ đệm dùng chung; người khác 404; lượt đang làm 409")
    void attemptFlow() throws Exception {
        long done = jdbc.queryForObject("""
                INSERT INTO mock_exam_attempts (user_id, exam_id, status, passed, total_score, answers_submitted_json)
                VALUES (?, ?, 'COMPLETED', FALSE, 50, '{"LV2-6":"b"}'::jsonb) RETURNING id
                """, Long.class, OWNER, examId);
        long running = jdbc.queryForObject("""
                INSERT INTO mock_exam_attempts (user_id, exam_id, status) VALUES (?, ?, 'IN_PROGRESS') RETURNING id
                """, Long.class, OWNER, examId);

        assertThat(ai.askAttempt(owner, done, "LESEN-2", "LV2-6", "en").cached()).isFalse();

        mockMvc.perform(post("/api/mock-exams/practice/attempts/{id}/teile/LESEN-2/items/LV2-6/ask-ai", done)
                        .with(user(owner)).contentType(MediaType.APPLICATION_JSON).content("{\"locale\":\"en\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cached").value(true))
                .andExpect(jsonPath("$.locale").value("en"));
        mockMvc.perform(post("/api/mock-exams/practice/attempts/{id}/teile/LESEN-2/items/LV2-6/ask-ai", done)
                        .with(user(other)).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/mock-exams/practice/attempts/{id}/teile/LESEN-2/items/LV2-6/ask-ai", running)
                        .with(user(owner)).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isConflict());
        mockMvc.perform(post("/api/mock-exams/practice/attempts/{id}/teile/LESEN-2/items/NOPE/ask-ai", done)
                        .with(user(owner)).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isNotFound());
        verify(chat, times(1)).chatCompletionForTier(any(), any(), anyDouble(), any(), eq(false));
    }

    @Test
    @DisplayName("Nháp thi thử: câu đánh dấu lưu và đọc lại; lưu không kèm flags (mobile cũ) giữ nguyên")
    void draftFlagsPersist() {
        long attemptId = jdbc.queryForObject("""
                INSERT INTO mock_exam_attempts (user_id, exam_id, status) VALUES (?, ?, 'IN_PROGRESS') RETURNING id
                """, Long.class, OWNER, examId);

        var saved = drafts.save(OWNER, attemptId, "{\"LV2-6\":\"a\"}", 0, null, 0L, Instant.now(),
                List.of("LV2-6", "LV2-6", " LV2-7 ", ""));
        assertThat(saved.outcome()).isEqualTo(MockExamDraftService.Outcome.SAVED);
        assertThat(drafts.parseFlags(drafts.load(OWNER, attemptId).flagsJson())).containsExactly("LV2-6", "LV2-7");

        drafts.save(OWNER, attemptId, "{\"LV2-6\":\"b\"}", 0, null, 1L, Instant.now());
        assertThat(drafts.parseFlags(drafts.load(OWNER, attemptId).flagsJson())).containsExactly("LV2-6", "LV2-7");

        drafts.save(OWNER, attemptId, "{\"LV2-6\":\"b\"}", 0, null, 2L, Instant.now(), List.of());
        assertThat(drafts.parseFlags(drafts.load(OWNER, attemptId).flagsJson())).isNull();
    }

    private void insertUser(long id, String role) {
        jdbc.update("""
                INSERT INTO users (id, email, password_hash, display_name, role, created_at)
                VALUES (?, ?, 'x', 'Học viên B3', ?, NOW())
                ON CONFLICT (id) DO NOTHING
                """, id, "b3-" + id + "@test.local", role);
    }

    private String column(String table, String column) {
        List<String> rows = jdbc.queryForList("""
                SELECT data_type FROM information_schema.columns WHERE table_name = ? AND column_name = ?
                """, String.class, table, column);
        return rows.isEmpty() ? null : rows.get(0);
    }
}
