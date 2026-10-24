package com.deutschflow.grammar.controller;

import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.grammar.dto.ExamFinishAcceptedDto;
import com.deutschflow.grammar.service.ExamScoringService;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.test.context.support.WithMockUser;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * Một lượt thi chỉ được chấm MỘT lần.
 *
 * <p>Trước bản vá, {@code POST /attempts/{id}/finish} không xem lượt thi còn {@code IN_PROGRESS}
 * hay không, và câu UPDATE kết quả chỉ lọc theo {@code id + user_id}. Gọi lại {@code /finish} trên
 * bài đã chấm ⇒ chấm lại từ đầu (gọi AI chấm Viết, ăn quota) rồi GHI ĐÈ {@code total_score},
 * {@code passed}, {@code finished_at} — tức là đổi được kết quả đỗ/trượt sau khi đã xem điểm.
 *
 * <p>Phải chạy trên PostgreSQL thật: thứ cần chứng minh là câu UPDATE có điều kiện chọn đúng 0 hàng
 * khi lượt thi đã rời {@code IN_PROGRESS}; mock JdbcTemplate chỉ lặp lại chuỗi SQL ta tự viết.
 *
 * <p>Chấm Viết được thay bằng stub trên spy để đếm số lần "gọi AI" mà không cần mô hình thật.
 * Dữ liệu dùng cấp <b>C2</b> — vùng trống không có đề seed (xem {@code MockExamPackGateIntegrationTest}).
 */
// Lớp controller mang @PreAuthorize("isAuthenticated()") — gọi thẳng bean cần một Authentication.
@WithMockUser(roles = "STUDENT")
@SpringBootTest
@DisplayName("Nộp bài thi thử: mỗi lượt chỉ chấm một lần")
class MockExamFinishOnceIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final long UID = 990_319L;
    private static final long STRANGER_UID = 990_320L;
    private static final String LEVEL = "C2";
    private static final String TITLE = "Đề C2 chấm một lần";
    private static final long JOB_WAIT_MS = 20_000;

    private static final String SECTIONS_JSON = """
        {"sections":[
          {"name":"LESEN","max_points":25,"teile":[{"items":[
             {"id":"L1","correct":"a"},{"id":"L2","correct":"a"}]}]},
          {"name":"SCHREIBEN","max_points":25,"teile":[{"task":"Schreiben Sie eine E-Mail."}]}
        ]}
        """;

    @MockBean private QuotaService quotaService;
    @MockBean private OrgPoolGuard orgPoolGuard;
    @SpyBean private ExamScoringService scoringService;

    @Autowired private MockExamController controller;
    @Autowired private JdbcTemplate jdbc;

    private final UserDetails principal = org.springframework.security.core.userdetails.User
            .withUsername(String.valueOf(UID)).password("x").authorities("ROLE_STUDENT").build();

    @BeforeEach
    void stubWritingGrader() {
        // Đứng thay cuộc gọi AI chấm Viết — mỗi lần gọi ở đây là một lần tốn quota ngoài đời.
        doAnswer(inv -> {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("total", 20);
            out.put("max", 25);
            out.put("status", ExamScoringService.STATUS_COMPLETED);
            return out;
        }).when(scoringService).scoreSchreibenSection(anyLong(), anyMap(), anyMap(), anyString(), isNull());
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM async_jobs WHERE created_by_user_id IN (?, ?)", UID, STRANGER_UID);
        jdbc.update("DELETE FROM mock_exam_attempts WHERE user_id = ?", UID);
        jdbc.update("DELETE FROM mock_exams WHERE cefr_level = ? AND title = ?", LEVEL, TITLE);
    }

    private long newInProgressAttempt() {
        long examId = jdbc.queryForObject("""
            INSERT INTO mock_exams (cefr_level, exam_format, title, sections_json, is_active, total_points, pass_points)
            VALUES (?, 'GOETHE', ?, ?::jsonb, TRUE, 100, 60)
            RETURNING id
            """, Long.class, LEVEL, TITLE, SECTIONS_JSON);
        return jdbc.queryForObject("""
            INSERT INTO mock_exam_attempts (user_id, exam_id, status)
            VALUES (?, ?, 'IN_PROGRESS')
            RETURNING id
            """, Long.class, UID, examId);
    }

    private static Map<String, Object> answers(String lesen, String schreiben) {
        Map<String, Object> a = new LinkedHashMap<>();
        a.put("L1", lesen);
        a.put("L2", lesen);
        if (schreiben != null) a.put("W1", schreiben);
        return Map.of("answers", a);
    }

    /** Chờ job nền rời PENDING/PROCESSING; trả trạng thái cuối. */
    private String awaitJob(String jobId) throws InterruptedException {
        long deadline = System.currentTimeMillis() + JOB_WAIT_MS;
        while (System.currentTimeMillis() < deadline) {
            String status = jdbc.queryForObject(
                    "SELECT status FROM async_jobs WHERE id = ?", String.class, UUID.fromString(jobId));
            if (!"PENDING".equals(status) && !"PROCESSING".equals(status)) return status;
            Thread.sleep(100);
        }
        throw new AssertionError("job " + jobId + " vẫn chưa xong sau " + JOB_WAIT_MS + " ms");
    }

    private Map<String, Object> attemptRow(long attemptId) {
        return jdbc.queryForMap("""
            SELECT status, total_score, passed, finished_at, answers_submitted_json::text AS answers
            FROM mock_exam_attempts WHERE id = ?
            """, attemptId);
    }

    @Test
    @DisplayName("gọi /finish lần hai trên bài đã chấm → 409, không chấm lại, không ghi đè điểm")
    void secondFinish_onCompletedAttempt_isRejectedWithoutRegrading() throws Exception {
        long attemptId = newInProgressAttempt();

        ResponseEntity<?> first = controller.finishExam(attemptId, answers("a", "Liebe Anna, ..."), principal);
        assertThat(first.getStatusCode().value()).isEqualTo(202);
        String firstJob = ((ExamFinishAcceptedDto) first.getBody()).jobId();
        assertThat(awaitJob(firstJob)).isEqualTo("COMPLETED");

        Map<String, Object> graded = attemptRow(attemptId);
        assertThat(graded.get("status")).isEqualTo("COMPLETED");
        assertThat(graded.get("passed")).isEqualTo(true);

        // Lần hai: trả lời sai hết, bỏ trống phần Viết — nếu được chấm lại thì sẽ trượt.
        ResponseEntity<?> second = controller.finishExam(attemptId, answers("b", null), principal);

        assertThat(second.getStatusCode().value()).isEqualTo(409);
        assertThat(second.getBody()).isInstanceOf(Map.class);
        assertThat(((Map<?, ?>) second.getBody()).get("error")).isEqualTo("ATTEMPT_NOT_IN_PROGRESS");
        assertThat(attemptRow(attemptId)).isEqualTo(graded);
        // Không mở job thứ hai, không chạm quota lần hai, AI chấm Viết đúng một lần.
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM async_jobs WHERE created_by_user_id = ? AND job_type = 'FINISH_EXAM'",
                Integer.class, UID)).isEqualTo(1);
        verify(quotaService, times(1)).assertAllowed(anyLong(), any(), anyLong());
        verify(orgPoolGuard, times(1)).assertOrgPoolAvailable(anyLong(), anyLong());
        verify(scoringService, times(1))
                .scoreSchreibenSection(anyLong(), anyMap(), anyMap(), anyString(), isNull());
    }

    @Test
    @DisplayName("hai lần nộp đua nhau: lần về sau thấy bài đã COMPLETED thì job FAILED, điểm của lần trước giữ nguyên")
    void racingFinish_conditionalUpdateKeepsTheFirstResult() throws Exception {
        long attemptId = newInProgressAttempt();

        // Giả lập lần nộp kia chấm xong ĐÚNG LÚC lần này đang chấm (cả hai đã qua cổng đồng bộ).
        doAnswer(inv -> {
            jdbc.update("""
                UPDATE mock_exam_attempts
                SET status = 'COMPLETED', finished_at = NOW(), total_score = 77, passed = TRUE
                WHERE id = ?
                """, attemptId);
            return inv.callRealMethod();
        }).when(scoringService).scoreObjectiveSection(anyMap(), anyMap());

        ResponseEntity<?> res = controller.finishExam(attemptId, answers("b", null), principal);
        assertThat(res.getStatusCode().value()).isEqualTo(202);
        String jobId = ((ExamFinishAcceptedDto) res.getBody()).jobId();

        assertThat(awaitJob(jobId)).isEqualTo("FAILED");
        Map<String, Object> row = attemptRow(attemptId);
        assertThat(row.get("total_score")).isEqualTo(77);
        assertThat(row.get("passed")).isEqualTo(true);
    }

    @Test
    @DisplayName("lượt thi không thuộc người gọi → 404 ngay, không mở job, không chạm quota")
    void finish_onForeignAttempt_isNotFound() {
        long attemptId = newInProgressAttempt();
        UserDetails stranger = org.springframework.security.core.userdetails.User
                .withUsername(String.valueOf(STRANGER_UID)).password("x").authorities("ROLE_STUDENT").build();

        ResponseEntity<?> res = controller.finishExam(attemptId, answers("a", null), stranger);

        assertThat(res.getStatusCode().value()).isEqualTo(404);
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM async_jobs WHERE created_by_user_id = ?", Integer.class, STRANGER_UID)).isZero();
        verify(quotaService, never()).assertAllowed(anyLong(), any(), anyLong());
        assertThat(attemptRow(attemptId).get("status")).isEqualTo("IN_PROGRESS");
    }
}
