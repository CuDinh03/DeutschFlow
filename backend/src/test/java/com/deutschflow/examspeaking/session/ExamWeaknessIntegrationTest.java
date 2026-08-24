package com.deutschflow.examspeaking.session;

import com.deutschflow.examspeaking.dto.CreateExamSessionRequest;
import com.deutschflow.examspeaking.dto.ExamSessionView;
import com.deutschflow.examspeaking.dto.WeaknessView;
import com.deutschflow.examspeaking.weakness.ExamWeaknessService;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.TokenUsage;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;

/**
 * Đợt 5a: lỗi drill (quickEval) chảy vào kho yếu điểm — user_grammar_errors + user_error_skills +
 * error_review_tasks (SRS) + speaking_exam_error_stats (facet dạng bài, V282) — và endpoint
 * weakness trả đúng yếu điểm + gói Redemittel. Tự skip khi không có Postgres.
 */
@SpringBootTest
class ExamWeaknessIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private ExamSessionService sessionService;
    @Autowired private ExamWeaknessService weaknessService;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @MockBean private OpenAiChatClient chatClient;

    private long userId;

    @BeforeEach
    void seedUserWithBudget() {
        User u = userRepository.save(User.builder()
                .email("exam-weak-it-" + System.nanoTime() + "@local.test")
                .passwordHash("$2a$10$h").displayName("Weakness IT").role(User.Role.STUDENT).build());
        userId = u.getId();
        jdbcTemplate.update("INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at) VALUES (?, 'PRO', 'ACTIVE', ?, NULL)",
                userId, Timestamp.from(Instant.parse("2026-01-01T00:00:00Z")));
        jdbcTemplate.update("INSERT INTO user_ai_token_wallets (user_id, balance, last_accrual_local_date) VALUES (?, ?, NULL)",
                userId, 1_000_000L);
        when(chatClient.chatCompletionForTier(any(), any(), anyDouble(), anyInt(), anyBoolean())).thenAnswer(inv -> {
            List<ChatMessage> msgs = inv.getArgument(0);
            String user = msgs.get(msgs.size() - 1).content();
            String body;
            if (user.contains("Bewerte NUR diese eine Äußerung")) {
                // Mã hợp lệ trong ErrorCatalog + severity MAJOR → phải sinh review task SRS
                body = "{\"score\":5,\"feedback_vi\":\"Chú ý vị trí động từ.\",\"corrections\":[{\"code\":\"WORD_ORDER.V2_MAIN_CLAUSE\",\"original\":\"Gern ich trinke Kaffee\",\"correction\":\"Ich trinke gern Kaffee\",\"severity\":\"MAJOR\"}],\"redemittel\":[\"Was trinken Sie gern?\"]}";
            } else {
                body = "{\"reply_de\":\"Ja, gern. Und Sie?\"}";
            }
            return new AiChatCompletionResult(body, TokenUsage.exact(120, 40, 160), "test", "fake-model");
        });
    }

    @Test
    @DisplayName("Drill 1 lượt: lỗi MAJOR đổ vào SRS (grammar+skill+review task) + stats theo dạng bài; weakness trả yếu điểm + Redemittel")
    void drillErrorFlowsIntoWeaknessStore() {
        ExamSessionView s = sessionService.create(userId, new CreateExamSessionRequest("GOETHE", "A1", "DRILL", 2));
        sessionService.submitTextTurn(userId, s.id(), "Gern ich trinke Kaffee.");

        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_grammar_errors WHERE user_id=? AND error_code='WORD_ORDER.V2_MAIN_CLAUSE'",
                Integer.class, userId)).isEqualTo(1);
        // sessionId exam KHÔNG được ghi vào cột session_id (tránh nhiễm join phiên AI-speaking)
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_grammar_errors WHERE user_id=? AND session_id IS NOT NULL",
                Integer.class, userId)).isZero();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_error_skills WHERE user_id=? AND error_code='WORD_ORDER.V2_MAIN_CLAUSE'",
                Integer.class, userId)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM error_review_tasks WHERE user_id=? AND error_code='WORD_ORDER.V2_MAIN_CLAUSE'",
                Integer.class, userId)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT seen_count FROM speaking_exam_error_stats WHERE user_id=? AND provider='GOETHE' AND level='A1' AND teil_no=2 AND error_code='WORD_ORDER.V2_MAIN_CLAUSE'",
                Integer.class, userId)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT archetype FROM speaking_exam_error_stats WHERE user_id=? AND error_code='WORD_ORDER.V2_MAIN_CLAUSE'",
                String.class, userId)).isEqualTo("CARD_QA");

        WeaknessView view = weaknessService.weakness(userId, "GOETHE", "A1");
        assertThat(view.weakPoints()).hasSize(1);
        WeaknessView.WeakPoint w = view.weakPoints().get(0);
        assertThat(w.errorCode()).isEqualTo("WORD_ORDER.V2_MAIN_CLAUSE");
        assertThat(w.exampleOriginal()).isEqualTo("Gern ich trinke Kaffee");
        assertThat(w.exampleCorrection()).isEqualTo("Ich trinke gern Kaffee");
        assertThat(w.lastSeverity()).isEqualTo("MAJOR");
        assertThat(w.contexts()).singleElement().satisfies(c -> {
            assertThat(c.archetype()).isEqualTo("CARD_QA");
            assertThat(c.teilNo()).isEqualTo(2);
        });
        assertThat(view.packs()).extracting(WeaknessView.RedemittelPack::archetype).containsExactly("CARD_QA");
        assertThat(view.packs().get(0).phrases()).isNotEmpty();

        // Lượt lỗi thứ hai cùng mã → stats tăng, không nhân đôi dòng
        sessionService.submitTextTurn(userId, s.id(), "Auch gern ich esse Brot.");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM speaking_exam_error_stats WHERE user_id=? AND error_code='WORD_ORDER.V2_MAIN_CLAUSE'",
                Integer.class, userId)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT seen_count FROM speaking_exam_error_stats WHERE user_id=? AND error_code='WORD_ORDER.V2_MAIN_CLAUSE'",
                Integer.class, userId)).isEqualTo(2);
    }

    @Test
    @DisplayName("Chưa có lỗi exam: weakness rỗng nhưng vẫn trả đủ gói Redemittel của dải cấp")
    void emptyWeaknessStillHasPacks() {
        WeaknessView view = weaknessService.weakness(userId, null, "A1");
        assertThat(view.weakPoints()).isEmpty();
        assertThat(view.packs()).hasSize(10);
    }
}
