package com.deutschflow.grammar.controller;

import com.deutschflow.grammar.dto.CertificateClaimDto;
import com.deutschflow.grammar.service.ExamScoringService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Chốt chống lạm dụng của EXAM-16: bài có phần bị loại khỏi mẫu số vì ứng dụng không dựng được phần
 * đó KHÔNG được dùng để nhận chứng nhận CEFR — mẫu số nhỏ hơn nghĩa là ngưỡng đỗ dễ hơn, nên nếu cho
 * qua đây thì khai báo "không làm được phần này" trở thành một đường hạ ngưỡng.
 *
 * <p>Phải là integration test trên PostgreSQL thật: điều kiện lọc là một truy vấn con
 * {@code jsonb_each} trên {@code detailed_scores_json}. Mock JdbcTemplate chỉ chứng minh ta gọi đúng
 * chuỗi SQL mình vừa viết, không chứng minh chuỗi đó chọn đúng hàng — mà rủi ro nằm đúng ở đó.
 *
 * <p>Ranh giới cần giữ: phần <b>chờ chấm</b> ({@code PENDING_AI_EVALUATION}) vẫn claim được như
 * trước. Đó là hạ tầng của ta hỏng, không phải lựa chọn của người học; siết cả nhóm này sẽ chặn mọi
 * chứng nhận vì phần Nói của đề 4 kỹ năng hiện luôn ở trạng thái chờ chấm.
 */
@SpringBootTest
@DisplayName("Claim chứng nhận CEFR bỏ qua bài có phần app không dựng được")
class CefrCertificateClaimGateIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final long UID = 990_318L;
    private static final String LEVEL = "C2";

    @Autowired private CertificateController controller;
    @Autowired private JdbcTemplate jdbc;

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM cefr_certificates WHERE user_id = ?", UID);
        jdbc.update("DELETE FROM mock_exam_attempts WHERE user_id = ?", UID);
        jdbc.update("DELETE FROM mock_exams WHERE cefr_level = ? AND title LIKE 'Đề C2 claim%'", LEVEL);
    }

    private final UserDetails principal = org.springframework.security.core.userdetails.User
            .withUsername(String.valueOf(UID)).password("x").authorities("ROLE_STUDENT").build();

    private long newExam() {
        return jdbc.queryForObject("""
            INSERT INTO mock_exams (cefr_level, exam_format, title, sections_json, is_active, total_points, pass_points)
            VALUES (?, 'GOETHE', 'Đề C2 claim gate', '{"sections":[]}'::jsonb, TRUE, 100, 60)
            RETURNING id
            """, Long.class, LEVEL);
    }

    /** Một bài ĐÃ ĐỖ với bảng điểm chi tiết cho sẵn — đây là thứ cổng claim phải đọc. */
    private void newPassedAttempt(long examId, int totalScore, String detailedScoresJson) {
        jdbc.update("""
            INSERT INTO mock_exam_attempts (user_id, exam_id, status, passed, total_score, detailed_scores_json)
            VALUES (?, ?, 'COMPLETED', TRUE, ?, ?::jsonb)
            """, UID, examId, totalScore, detailedScoresJson);
    }

    private String sectionJson(String lesenStatus, String hoerenStatus) {
        return """
            {"LESEN":{"total":25,"max":25,"status":"%s"},
             "HOEREN":{"total":0,"max":25,"status":"%s"}}
            """.formatted(lesenStatus, hoerenStatus);
    }

    private ResponseEntity<CertificateClaimDto> claim() {
        return controller.claimCertificate(Map.of("cefrLevel", LEVEL), principal);
    }

    @Test
    @DisplayName("bài có phần SKIPPED_ON_CLIENT dù passed = TRUE vẫn không cấp được chứng nhận")
    void attemptWithSkippedSection_isNotClaimable() {
        newPassedAttempt(newExam(), 100,
                sectionJson(ExamScoringService.STATUS_COMPLETED, ExamScoringService.STATUS_SKIPPED_ON_CLIENT));

        ResponseEntity<CertificateClaimDto> res = claim();

        assertThat(res.getStatusCode().is4xxClientError()).isTrue();
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM cefr_certificates WHERE user_id = ?", Integer.class, UID)).isZero();
    }

    @Test
    @DisplayName("bài chỉ thiếu phần chờ chấm vẫn cấp được — ranh giới cũ không bị siết theo")
    void attemptWithPendingSection_isStillClaimable() {
        newPassedAttempt(newExam(), 100,
                sectionJson(ExamScoringService.STATUS_COMPLETED, ExamScoringService.STATUS_PENDING));

        ResponseEntity<CertificateClaimDto> res = claim();

        assertThat(res.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM cefr_certificates WHERE user_id = ?", Integer.class, UID)).isEqualTo(1);
    }

    @Test
    @DisplayName("bảng điểm chi tiết rỗng (bài cũ trước khi có cột) không bị cổng này chặn oan")
    void attemptWithoutDetailedScores_isStillClaimable() {
        long examId = newExam();
        jdbc.update("""
            INSERT INTO mock_exam_attempts (user_id, exam_id, status, passed, total_score)
            VALUES (?, ?, 'COMPLETED', TRUE, 88)
            """, UID, examId);

        assertThat(claim().getStatusCode().is2xxSuccessful()).isTrue();
    }

    @Test
    @DisplayName("có cả bài sạch lẫn bài bị bỏ phần thì chọn bài sạch, không phải bài điểm cao hơn")
    void picksTheCleanAttempt_notTheHigherScoredSkippedOne() {
        long examId = newExam();
        newPassedAttempt(examId, 100,
                sectionJson(ExamScoringService.STATUS_COMPLETED, ExamScoringService.STATUS_SKIPPED_ON_CLIENT));
        newPassedAttempt(examId, 72,
                sectionJson(ExamScoringService.STATUS_COMPLETED, ExamScoringService.STATUS_COMPLETED));

        assertThat(claim().getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(jdbc.queryForObject(
                "SELECT exam_score FROM cefr_certificates WHERE user_id = ?", Integer.class, UID))
                .isEqualTo(72);
    }
}
