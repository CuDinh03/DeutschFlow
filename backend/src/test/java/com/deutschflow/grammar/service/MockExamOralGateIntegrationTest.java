package com.deutschflow.grammar.service;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cổng Nói của đề telc trên PostgreSQL thật.
 *
 * <p><b>Vì sao cần DB thật.</b> Bản này thêm hai câu SQL mới: một câu chọn phiên thi nói điểm cao
 * nhất trong {@code speaking_exam_results} (bảng của module KHÁC, đọc bằng JdbcTemplate để không
 * tạo phụ thuộc vòng), và một câu nối {@code mock_exam_attempts} với {@code mock_exams} để tính lại
 * kết luận đỗ/trượt. Rủi ro nằm đúng ở chỗ hai câu đó có chọn đúng hàng không — mock JdbcTemplate
 * sẽ trả về con số ta tự đặt và không chứng minh được gì.
 *
 * <p>Dùng cấp <b>C2</b> cho mọi dữ liệu dựng sẵn: A1–C1 đã có đề seed nên C2 là vùng trống duy nhất
 * không làm nhiễu và không bị nhiễu.
 */
@SpringBootTest
@DisplayName("Cổng Nói của đề telc (MockExamOralGateService)")
class MockExamOralGateIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final long UID = 990_915L;
    private static final String LEVEL = "C2";

    private static final String PASS_RULE_JSON = """
        {"format":"TELC",
         "pass_rule":{
           "written":{"sections":["LESEN","SPRACHBAUSTEINE","HOEREN","SCHREIBEN"],"max":225,"min":135},
           "oral":{"source":"SPEAKING_SESSION","provider":"TELC","max":75,"min":45}},
         "sections":[]}
        """;

    @Autowired private MockExamOralGateService service;
    @Autowired private JdbcTemplate jdbc;

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM speaking_exam_results WHERE user_id = ?", UID);
        jdbc.update("DELETE FROM mock_exam_attempts WHERE user_id = ?", UID);
        jdbc.update("DELETE FROM mock_exams WHERE cefr_level = ?", LEVEL);
        jdbc.update("DELETE FROM speaking_exam_sessions WHERE user_id = ?", UID);
        jdbc.update("DELETE FROM users WHERE id = ?", UID);
    }

    @Test
    @DisplayName("chưa thi nói lần nào thì không có điểm cổng Nói — cổng đó phải là CHỜ")
    void noSpeakingResult_returnsEmpty() {
        assertThat(service.bestSpeakingResult(UID, "TELC", LEVEL)).isEmpty();
        assertThat(service.externalScores(UID, passRule(), LEVEL)).isEmpty();
    }

    @Test
    @DisplayName("lấy phiên ĐIỂM CAO NHẤT, không phải phiên mới nhất")
    void picksHighestScore_notLatest() {
        givenUser();
        long cao = givenSpeakingResult(68.0, "TELC", LEVEL);
        givenSpeakingResult(51.0, "TELC", LEVEL);   // mới hơn nhưng thấp điểm hơn

        var best = service.bestSpeakingResult(UID, "TELC", LEVEL);

        assertThat(best).isPresent();
        assertThat(best.get().raw()).isEqualTo(68.0);
        assertThat(best.get().sourceId()).isEqualTo(cao);
        assertThat(best.get().achievedAt()).isNotNull();
    }

    @Test
    @DisplayName("không lẫn phiên của nhà tổ chức khác hay bậc khác")
    void ignoresOtherProviderOrLevel() {
        givenUser();
        givenSpeakingResult(75.0, "GOETHE", LEVEL);
        givenSpeakingResult(75.0, "TELC", "B1");

        assertThat(service.bestSpeakingResult(UID, "TELC", LEVEL)).isEmpty();
    }

    @Test
    @DisplayName("thi viết trước, thi nói sau: kết luận của bài viết được tính lại và GHI XUỐNG")
    void reconcile_flipsStoredVerdictAfterSpeakingResult() {
        givenUser();
        long examId = givenTelcExam();
        long attemptId = givenCompletedAttempt(examId, /*passed*/ false, perfectWritten());

        givenSpeakingResult(60.0, "TELC", LEVEL);
        int changed = service.reconcileAttempts(UID, "TELC", LEVEL);

        assertThat(changed).isEqualTo(1);
        assertThat(storedPassed(attemptId))
                .as("đỗ cả hai cổng thì cột `passed` phải theo kịp, kẻo lịch sử và chứng nhận nói khác màn kết quả")
                .isTrue();
    }

    @Test
    @DisplayName("thi nói không đạt thì bài viết KHÔNG được nâng thành đỗ")
    void reconcile_failingSpeaking_keepsNotPassed() {
        givenUser();
        long examId = givenTelcExam();
        long attemptId = givenCompletedAttempt(examId, false, perfectWritten());

        givenSpeakingResult(40.0, "TELC", LEVEL);
        service.reconcileAttempts(UID, "TELC", LEVEL);

        assertThat(storedPassed(attemptId)).isFalse();
    }

    @Test
    @DisplayName("đề không khai pass_rule (mọi đề Goethe) thì không bị đụng tới")
    void reconcile_examWithoutPassRule_isUntouched() {
        givenUser();
        long examId = jdbc.queryForObject("""
            INSERT INTO mock_exams (cefr_level, exam_format, title, sections_json, total_points, pass_points, is_active)
            VALUES (?, 'TELC', 'Đề C2 không có pass_rule', '{"sections":[]}'::jsonb, 100, 60, TRUE)
            RETURNING id
            """, Long.class, LEVEL);
        long attemptId = givenCompletedAttempt(examId, true, perfectWritten());

        givenSpeakingResult(10.0, "TELC", LEVEL);
        int changed = service.reconcileAttempts(UID, "TELC", LEVEL);

        assertThat(changed).isZero();
        assertThat(storedPassed(attemptId)).isTrue();
    }

    // ─── Dữ liệu dựng sẵn ────────────────────────────────────────────────────

    private Map<String, Object> passRule() {
        return Map.of("oral", Map.of("source", "SPEAKING_SESSION", "provider", "TELC", "max", 75, "min", 45));
    }

    private String perfectWritten() {
        return """
            {"LESEN":{"total":75,"max":75,"status":"COMPLETED"},
             "SPRACHBAUSTEINE":{"total":30,"max":30,"status":"COMPLETED"},
             "HOEREN":{"total":75,"max":75,"status":"COMPLETED"},
             "SCHREIBEN":{"total":45,"max":45,"status":"COMPLETED"}}
            """;
    }

    private void givenUser() {
        jdbc.update("""
            INSERT INTO users (id, email, password_hash, display_name, role, created_at)
            VALUES (?, ?, 'x', 'Test cổng Nói', 'STUDENT', NOW())
            ON CONFLICT (id) DO NOTHING
            """, UID, "telc-oral-gate-" + UID + "@test.local");
    }

    private long givenTelcExam() {
        return jdbc.queryForObject("""
            INSERT INTO mock_exams (cefr_level, exam_format, title, sections_json, total_points, pass_points, is_active)
            VALUES (?, 'TELC', 'Đề telc C2 dựng cho test cổng Nói', ?::jsonb, 225, 135, TRUE)
            RETURNING id
            """, Long.class, LEVEL, PASS_RULE_JSON);
    }

    private long givenCompletedAttempt(long examId, boolean passed, String detailedJson) {
        return jdbc.queryForObject("""
            INSERT INTO mock_exam_attempts (user_id, exam_id, status, passed, total_score,
                                            detailed_scores_json, started_at, finished_at)
            VALUES (?, ?, 'COMPLETED', ?, 100, ?::jsonb, NOW(), NOW())
            RETURNING id
            """, Long.class, UID, examId, passed, detailedJson);
    }

    /** @return session_id của kết quả vừa tạo */
    private long givenSpeakingResult(double total, String provider, String level) {
        long sessionId = jdbc.queryForObject("""
            INSERT INTO speaking_exam_sessions (user_id, blueprint_id, mode, state, plan_json)
            VALUES (?, (SELECT id FROM speaking_exam_blueprints LIMIT 1), 'MOCK', 'RESULTS', '{}'::jsonb)
            RETURNING id
            """, Long.class, UID);
        jdbc.update("""
            INSERT INTO speaking_exam_results (session_id, user_id, provider, level, rubric_version,
                                               score_sheet_json, total_points, max_points, passed)
            VALUES (?, ?, ?, ?, 1, '{}'::jsonb, ?, 75, ?)
            """, sessionId, UID, provider, level, total, total >= 45);
        return sessionId;
    }

    private Boolean storedPassed(long attemptId) {
        return jdbc.queryForObject("SELECT passed FROM mock_exam_attempts WHERE id = ?", Boolean.class, attemptId);
    }
}
