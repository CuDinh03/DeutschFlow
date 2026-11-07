package com.deutschflow.grammar.service;

import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.common.quota.QuotaSnapshot;
import com.deutschflow.grammar.dto.ExamPlanDto;
import com.deutschflow.grammar.dto.PracticeDtos;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.repository.UserRepository;
import com.deutschflow.user.service.UserLearningProfileService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Bài chẩn đoán (V365) trên PostgreSQL thật: bắt đầu ghi hồ sơ + chọn đề seed, tự đánh giá ghép JSONB,
 * chốt kết quả, và lộ trình đếm ngược xếp Teil yếu nhất của bài chẩn đoán lên đầu tuần 1.
 * Đường luyện đề được giả lập (chấm từng Teil đã có test riêng). Service dựng tay với bản giả đó
 * thay vì {@code @MockBean}: một tổ hợp MockBean mới là một Spring context mới kèm một pool kết nối,
 * và CI từng vượt {@code max_connections} của Postgres ("too many clients") vì vậy. Lớp này dùng chung
 * context với {@code ExamPlanServiceIntegrationTest} (chỉ MockBean QuotaService).
 */
@SpringBootTest
@DisplayName("Bài chẩn đoán (ExamDiagnosticService) trên Postgres")
class ExamDiagnosticServiceIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final long UID = 990_365L;

    @MockBean private QuotaService quotaService;

    @Autowired private ExamPlanService planService;
    @Autowired private UserLearningProfileService profileService;
    @Autowired private UserLearningProfileRepository profileRepository;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository users;
    @Autowired private JdbcTemplate jdbc;

    private User user;
    private final MockExamPracticeService practice = mock(MockExamPracticeService.class);
    private ExamDiagnosticService service;

    @BeforeEach
    void setUp() {
        jdbc.update("""
            INSERT INTO users (id, email, password_hash, display_name, role, created_at)
            VALUES (?, ?, 'x', 'Test chẩn đoán', 'STUDENT', NOW())
            ON CONFLICT (id) DO NOTHING
            """, UID, "diag-" + UID + "@test.local");
        jdbc.update("""
            INSERT INTO user_learning_profiles
              (user_id, goal_type, target_level, current_level, sessions_per_week, minutes_per_session, created_at, updated_at)
            VALUES (?, 'CERT', 'A2', 'A2', 5, 40, NOW(), NOW())
            """, UID);
        user = users.findById(UID).orElseThrow();
        service = new ExamDiagnosticService(jdbc, objectMapper, practice, profileService, profileRepository);
        when(quotaService.getSnapshotReadOnly(anyLong(), any()))
                .thenReturn(new QuotaSnapshot("PRO", false, null, null, 0L, 0L, 0L, 0L, 0L, null, null));
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM exam_diagnostics WHERE user_id = ?", UID);
        jdbc.update("DELETE FROM speaking_exam_sessions WHERE user_id = ?", UID);
        jdbc.update("DELETE FROM exam_plan_state WHERE user_id = ?", UID);
        jdbc.update("DELETE FROM user_learning_profiles WHERE user_id = ?", UID);
        jdbc.update("DELETE FROM users WHERE id = ?", UID);
    }

    private static PracticeDtos.Overview overview(long id, double lesen, double bausteine, double hoeren, double schreiben) {
        return new PracticeDtos.Overview(id, "Đề", "B1", "TELC", "{}", List.of(
                teil("LESEN-1", 25, lesen), teil("SPRACHBAUSTEINE-1", 15, bausteine), teil("HOEREN-1", 25, hoeren),
                teil("SCHREIBEN-1", 45, schreiben)));
    }

    /** Một lượt thi thử phần nói telc B1 đã có điểm (như job chấm nền ghi). */
    private void oralResult(double total) {
        Long blueprint = jdbc.queryForObject(
                "SELECT id FROM speaking_exam_blueprints WHERE provider = 'TELC' AND level = 'B1' ORDER BY version DESC LIMIT 1", Long.class);
        Long session = jdbc.queryForObject("""
            INSERT INTO speaking_exam_sessions (user_id, blueprint_id, mode, state, plan_json, finished_at)
            VALUES (?, ?, 'MOCK', 'RESULTS', '{}'::jsonb, NOW()) RETURNING id
            """, Long.class, UID, blueprint);
        jdbc.update("""
            INSERT INTO speaking_exam_results (session_id, user_id, provider, level, rubric_version, score_sheet_json, total_points, max_points)
            VALUES (?, ?, 'TELC', 'B1', 1, '{}'::jsonb, ?, 75)
            """, session, UID, total);
    }

    private static PracticeDtos.Teil teil(String key, double max, double score) {
        PracticeDtos.Progress p = score < 0 ? null : new PracticeDtos.Progress(Map.of(), true, score, max, 0, null, null);
        return new PracticeDtos.Teil(key, key.substring(0, key.indexOf('-')), 1, null, 5, max, 10, p);
    }

    @Test
    @DisplayName("Bắt đầu → bốn Teil + thi nói → chốt; lộ trình lấy Lesen (yếu nhất) làm trọng tâm tuần 1")
    void fullFlow() {
        when(practice.overview(any(), anyLong())).thenReturn(overview(1, -1, -1, -1, -1));
        ExamDiagnosticService.View started = service.start(user, LocalDate.now().plusWeeks(4), 30);
        assertThat(started.status()).isEqualTo(ExamDiagnosticService.STATUS_IN_PROGRESS);
        Map<String, Object> profile = jdbc.queryForMap(
                "SELECT exam_type, target_level, daily_goal_minutes, target_date FROM user_learning_profiles WHERE user_id = ?", UID);
        assertThat(profile).containsEntry("exam_type", "TELC").containsEntry("target_level", "B1").containsEntry("daily_goal_minutes", 30);

        assertThat(started.oral()).isNull();

        oralResult(60);
        assertThat(service.view(user).oral()).isNotNull();
        when(practice.overview(any(), anyLong())).thenReturn(overview(started.examId(), 5, 13, 22, 36));
        ExamDiagnosticService.View done = service.finish(user);
        assertThat(done.status()).isEqualTo(ExamDiagnosticService.STATUS_DONE);
        // (5 + 13) / 40 = 45%
        assertThat(done.skills()).containsEntry("LESEN", 45).containsEntry("HOEREN", 88).containsEntry("SCHREIBEN", 80)
                .containsEntry("SPRECHEN", 80);

        ExamPlanDto plan = planService.planFor(UID, LocalDate.now());
        assertThat(plan.status()).isEqualTo(ExamPlanService.STATUS_ACTIVE);
        assertThat(plan.weeks().get(0).focus()).extracting(ExamPlanDto.FocusDto::section).contains("LESEN");
    }
}
