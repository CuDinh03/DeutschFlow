package com.deutschflow.grammar.controller;

import com.deutschflow.common.async.AsyncJobDispatch;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.speaking.exception.AiErrorCode;
import com.deutschflow.speaking.exception.AiServiceException;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.util.AopTestUtils;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;
import java.util.concurrent.Executor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * {@code aiExecutor} đầy lúc nộp bài thi thử: job {@code FINISH_EXAM} vừa tạo phải thành FAILED NGAY
 * (không nằm PENDING chờ việc quét 30′ sau), request ra 503 AI_BUSY, lượt thi vẫn {@code IN_PROGRESS}
 * để nộp lại được.
 *
 * <p>Executor được thay tạm trên ĐỐI TƯỢNG GỐC của controller (bean là proxy vì
 * {@code @PreAuthorize}) rồi trả lại ở {@code @AfterEach} — không đụng bean {@code aiExecutor} dùng chung.
 */
// Lớp controller mang @PreAuthorize("isAuthenticated()") — gọi thẳng bean cần một Authentication.
@WithMockUser(roles = "STUDENT")
@SpringBootTest
@DisplayName("Nộp bài thi thử khi aiExecutor đầy")
class MockExamFinishExecutorBusyIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final long UID = 990_322L;
    private static final String LEVEL = "C2";
    private static final String TITLE = "Đề C2 executor đầy";

    @MockBean private QuotaService quotaService;
    @MockBean private OrgPoolGuard orgPoolGuard;

    @Autowired private MockExamController controller;
    @Autowired private JdbcTemplate jdbc;

    private Object target;
    private Object originalExecutor;

    private final UserDetails principal = org.springframework.security.core.userdetails.User
            .withUsername(String.valueOf(UID)).password("x").authorities("ROLE_STUDENT").build();

    @AfterEach
    void restore() {
        if (target != null) ReflectionTestUtils.setField(target, "aiExecutor", originalExecutor);
        jdbc.update("DELETE FROM async_jobs WHERE created_by_user_id = ?", UID);
        jdbc.update("DELETE FROM mock_exam_attempts WHERE user_id = ?", UID);
        jdbc.update("DELETE FROM mock_exams WHERE cefr_level = ? AND title = ?", LEVEL, TITLE);
    }

    @Test
    @DisplayName("executor từ chối ⇒ 503 AI_BUSY, job FAILED ngay với câu người đọc được, lượt thi vẫn IN_PROGRESS")
    void rejectedFinish_failsJobImmediately() {
        long examId = jdbc.queryForObject("""
            INSERT INTO mock_exams (cefr_level, exam_format, title, sections_json, is_active, total_points, pass_points)
            VALUES (?, 'GOETHE', ?, '{"sections":[]}'::jsonb, TRUE, 100, 60)
            RETURNING id
            """, Long.class, LEVEL, TITLE);
        long attemptId = jdbc.queryForObject("""
            INSERT INTO mock_exam_attempts (user_id, exam_id, status) VALUES (?, ?, 'IN_PROGRESS') RETURNING id
            """, Long.class, UID, examId);

        target = AopTestUtils.getUltimateTargetObject(controller);
        originalExecutor = ReflectionTestUtils.getField(target, "aiExecutor");
        Executor full = task -> { throw new TaskRejectedException("aiExecutor full"); };
        ReflectionTestUtils.setField(target, "aiExecutor", full);

        assertThatThrownBy(() -> controller.finishExam(attemptId, Map.of("answers", Map.of()), principal))
                .isInstanceOfSatisfying(AiServiceException.class,
                        ex -> assertThat(ex.getCode()).isEqualTo(AiErrorCode.AI_BUSY));

        Map<String, Object> job = jdbc.queryForMap("""
            SELECT status, error_message FROM async_jobs
            WHERE created_by_user_id = ? AND job_type = 'FINISH_EXAM'
            """, UID);
        assertThat(job.get("status")).isEqualTo("FAILED");
        assertThat(job.get("error_message")).isEqualTo(AsyncJobDispatch.BUSY_MESSAGE);
        assertThat(jdbc.queryForObject(
                "SELECT status FROM mock_exam_attempts WHERE id = ?", String.class, attemptId))
                .isEqualTo("IN_PROGRESS");
    }
}
