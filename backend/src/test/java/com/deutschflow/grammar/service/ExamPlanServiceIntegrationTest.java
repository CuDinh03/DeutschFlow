package com.deutschflow.grammar.service;

import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.common.quota.QuotaSnapshot;
import com.deutschflow.common.quota.QuotaVnCalendar;
import com.deutschflow.grammar.dto.ExamPlanDto;
import com.deutschflow.grammar.dto.ExamPlanDto.TaskDto;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

/**
 * Lộ trình đếm ngược LT3 trên PostgreSQL thật. Rủi ro thật nằm ở các câu SQL đọc bảng của nhiều module
 * (tên cột, kiểu ngày, {@code ?::jsonb}) và ở V349; {@code ExamPlanServiceTest} mock JdbcTemplate nên
 * không chứng minh được những thứ đó. Đề telc B1 lấy từ seed Flyway.
 */
@SpringBootTest
@DisplayName("Lộ trình đếm ngược (ExamPlanService) trên Postgres")
class ExamPlanServiceIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final long UID = 990_349L;
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 2);

    @MockBean private QuotaService quotaService;

    @Autowired private ExamPlanService service;
    @Autowired private JdbcTemplate jdbc;

    @BeforeEach
    void setUp() {
        jdbc.update("""
            INSERT INTO users (id, email, password_hash, display_name, role, created_at)
            VALUES (?, ?, 'x', 'Test lộ trình thi', 'STUDENT', NOW())
            ON CONFLICT (id) DO NOTHING
            """, UID, "exam-plan-" + UID + "@test.local");
        jdbc.update("""
            INSERT INTO user_learning_profiles
              (user_id, goal_type, target_level, current_level, exam_type, target_date,
               sessions_per_week, minutes_per_session, created_at, updated_at)
            VALUES (?, 'CERT', 'B1', 'A2', 'TELC', ?, 5, 40, NOW(), NOW())
            """, UID, Date.valueOf(TODAY.plusWeeks(4)));
        when(quotaService.getSnapshotReadOnly(anyLong(), any()))
                .thenReturn(new QuotaSnapshot("PRO", false, null, null, 0L, 0L, 0L, 0L, 0L, null, null));
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM mock_exam_attempts WHERE user_id = ?", UID);
        jdbc.update("DELETE FROM exam_plan_state WHERE user_id = ?", UID);
        jdbc.update("DELETE FROM user_learning_profiles WHERE user_id = ?", UID);
        jdbc.update("DELETE FROM users WHERE id = ?", UID);
    }

    private long telcExam() {
        return jdbc.queryForObject("""
            SELECT id FROM mock_exams
            WHERE exam_format = 'TELC' AND cefr_level = 'B1' AND is_active = TRUE AND reviewed = TRUE
            ORDER BY id LIMIT 1
            """, Long.class);
    }

    private void completedAttempt(long examId, LocalDate date) {
        jdbc.update("""
            INSERT INTO mock_exam_attempts (user_id, exam_id, status, finished_at, total_score)
            VALUES (?, ?, 'COMPLETED', ?, 60)
            """, UID, examId, Timestamp.from(QuotaVnCalendar.startOfVnDay(date).plusSeconds(3600)));
    }

    private static TaskDto task(ExamPlanDto plan, int week, String type) {
        return plan.weeks().get(week - 1).tasks().stream()
                .filter(t -> t.type().equals(type)).findFirst().orElseThrow();
    }

    @Test
    @DisplayName("Đọc lần đầu: mọi câu SQL chạy được, ghi trạng thái và chốt trọng tâm tuần 1")
    void firstRead_createsState() {
        ExamPlanDto plan = service.planFor(UID, TODAY);

        assertThat(plan.status()).isEqualTo(ExamPlanService.STATUS_ACTIVE);
        assertThat(plan.totalWeeks()).isEqualTo(4);
        assertThat(task(plan, 3, "FULL_EXAM").examId()).isEqualTo(telcExam());

        Date start = jdbc.queryForObject("SELECT start_date FROM exam_plan_state WHERE user_id = ?", Date.class, UID);
        assertThat(start.toLocalDate()).isEqualTo(TODAY);
        Integer lockedWeek = jdbc.queryForObject(
                "SELECT count(*) FROM exam_plan_state WHERE user_id = ? AND jsonb_exists(locked_weeks_json, '1')",
                Integer.class, UID);
        assertThat(lockedWeek).isEqualTo(1);
    }

    @Test
    @DisplayName("Đọc lại: giữ ngày bắt đầu, tuần chốt đọc được từ JSONB")
    void secondRead_keepsState() {
        ExamPlanDto first = service.planFor(UID, TODAY);
        ExamPlanDto later = service.planFor(UID, TODAY.plusDays(8));

        assertThat(later.currentWeek()).isEqualTo(2);
        assertThat(later.weeks().get(0).focus()).isEqualTo(first.weeks().get(0).focus());
    }

    @Test
    @DisplayName("Đổi ngày thi trong hồ sơ: tính lại từ hôm nay")
    void dateChange_restarts() {
        service.planFor(UID, TODAY);
        jdbc.update("UPDATE user_learning_profiles SET target_date = ? WHERE user_id = ?",
                Date.valueOf(TODAY.plusWeeks(14)), UID);

        ExamPlanDto plan = service.planFor(UID, TODAY.plusDays(3));

        assertThat(plan.currentWeek()).isEqualTo(1);
        Date start = jdbc.queryForObject("SELECT start_date FROM exam_plan_state WHERE user_id = ?", Date.class, UID);
        assertThat(start.toLocalDate()).isEqualTo(TODAY.plusDays(3));
    }

    @Test
    @DisplayName("Đề nộp trong tuần vào tiến độ tuần đó; tuần sau không giao lại đề đó")
    void attemptInsideWeek_countsAndIsNotReassigned() {
        long exam = telcExam();
        service.planFor(UID, TODAY);
        completedAttempt(exam, TODAY.plusWeeks(2).plusDays(1));

        ExamPlanDto plan = service.planFor(UID, TODAY.plusWeeks(2).plusDays(2));

        assertThat(task(plan, 3, "FULL_EXAM").done()).isTrue();
        assertThat(task(plan, 3, "FULL_EXAM").examId()).isEqualTo(exam);
        assertThat(task(plan, 4, "FULL_EXAM").examId()).isNotEqualTo(exam);
    }

    @Test
    @DisplayName("Xoá người dùng kéo theo trạng thái kế hoạch (ON DELETE CASCADE)")
    void deletingUser_removesState() {
        service.planFor(UID, TODAY);
        jdbc.update("DELETE FROM user_learning_profiles WHERE user_id = ?", UID);
        jdbc.update("DELETE FROM users WHERE id = ?", UID);

        assertThat(jdbc.queryForObject("SELECT count(*) FROM exam_plan_state WHERE user_id = ?", Integer.class, UID)).isZero();
    }
}
