package com.deutschflow.grammar.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.grammar.dto.PracticeDtos;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Luyện thi một luồng (06/11/2026): Hören vào chế độ luyện từng Teil, và màn kết quả thi thử trọn đề
 * phân tích từng câu bằng cùng {@link PracticeAnalysis} — chỉ chủ lượt thi đọc được.
 */
@SpringBootTest
@DisplayName("Luyện thi telc — Hören trong luyện + phân tích lượt thi trọn đề")
class MockExamAttemptAnalysisIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final long UID = 991_306L;
    private static final long OTHER = 991_307L;

    @Autowired private MockExamPracticeService practice;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper om;

    private long examId;

    @BeforeEach
    void setUp() {
        for (long id : new long[] {UID, OTHER}) {
            jdbc.update("""
                    INSERT INTO users (id, email, password_hash, display_name, role, created_at)
                    VALUES (?, ?, 'x', 'Học viên thi thử', 'STUDENT', NOW())
                    ON CONFLICT (id) DO NOTHING
                    """, id, "analysis-" + id + "@test.local");
        }
        // Đề telc B1 Set 1 (V325 + V327): Hören Teil 1 có HV1-41 = richtig, HV1-42 = falsch.
        examId = jdbc.queryForObject("""
                SELECT id FROM mock_exams
                WHERE exam_format = 'TELC' AND sections_json::text LIKE '%HV1-41%'
                ORDER BY id LIMIT 1
                """, Long.class);
    }

    @AfterEach
    void tearDown() {
        jdbc.update("DELETE FROM mock_exam_attempts WHERE user_id IN (?, ?)", UID, OTHER);
        jdbc.update("DELETE FROM users WHERE id IN (?, ?)", UID, OTHER);
    }

    @Test
    void cheDoLuyenCoDuBaTeilHoeren() throws Exception {
        String sections = jdbc.queryForObject("SELECT sections_json::text FROM mock_exams WHERE id = ?",
                String.class, examId);
        @SuppressWarnings("unchecked")
        Map<String, Object> structure = om.readValue(sections, Map.class);

        assertThat(MockExamPracticeService.practiceTeile(structure).keySet())
                .contains("LESEN-1", "SPRACHBAUSTEINE-1", "HOEREN-1", "HOEREN-2", "HOEREN-3", "SCHREIBEN-1")
                .doesNotContain("SPRECHEN-1");
    }

    @Test
    void phanTichLuotThi_cauHoerenCoViSaoDung_baiVietKemPhieu() {
        long attemptId = completedAttempt(UID,
                "{\"HV1-41\":\"richtig\",\"HV1-42\":\"richtig\",\"email_1\":\"Liebe Lena, der Juli passt.\"}",
                "{\"SCHREIBEN\":{\"total\":27,\"max\":45,\"teil2_email\":{\"total\":27,\"max\":45,\"bands\":{\"I\":\"B\"}}}}");

        PracticeDtos.AttemptAnalysis a = practice.attemptAnalysis(student(UID), attemptId);

        assertThat(a.examId()).isEqualTo(examId);
        var hoeren1 = a.teile().stream().filter(t -> t.teilKey().equals("HOEREN-1")).findFirst().orElseThrow();
        var right = hoeren1.items().stream().filter(i -> i.id().equals("HV1-41")).findFirst().orElseThrow();
        var wrong = hoeren1.items().stream().filter(i -> i.id().equals("HV1-42")).findFirst().orElseThrow();
        assertThat(right.isCorrect()).isTrue();
        assertThat(right.correctText()).isEqualTo("Richtig");
        assertThat(wrong.isCorrect()).isFalse();
        assertThat(wrong.givenText()).isEqualTo("Richtig");
        assertThat(wrong.correctText()).isEqualTo("Falsch");
        assertThat(wrong.whyRight()).isNotBlank();
        assertThat(a.teile()).noneMatch(t -> t.teilKey().startsWith("SCHREIBEN"));
        assertThat(a.writingText()).isEqualTo("Liebe Lena, der Juli passt.");
        assertThat(a.writing()).isInstanceOf(Map.class);
        assertThat(((Map<?, ?>) a.writing()).get("total")).isEqualTo(27);
        assertThat(a.sectionsJson()).doesNotContain("\"correct\"");
    }

    @Test
    void nguoiKhacHoacLuotChuaNop_khongDocDuoc() {
        long attemptId = completedAttempt(UID, "{}", "{}");
        assertThatThrownBy(() -> practice.attemptAnalysis(student(OTHER), attemptId))
                .isInstanceOf(NotFoundException.class);

        Long inProgress = jdbc.queryForObject("""
                INSERT INTO mock_exam_attempts (user_id, exam_id, status) VALUES (?, ?, 'IN_PROGRESS') RETURNING id
                """, Long.class, UID, examId);
        assertThatThrownBy(() -> practice.attemptAnalysis(student(UID), inProgress))
                .isInstanceOf(NotFoundException.class);
    }

    /** Đợt 5 (09/11/2026): điểm Teil của lượt thi thử cho "Bốn kỹ năng" — chỉ của chính mình, đã nộp hoặc dừng. */
    @Test
    void diemTeilThiThu_chiCuaMinh_tuLuotDaNopVaLuotDung() {
        completedAttempt(UID, "{\"HV1-41\":\"richtig\",\"HV1-42\":\"richtig\"}", "{}");
        jdbc.update("""
                INSERT INTO mock_exam_attempts (user_id, exam_id, status, answers_submitted_json, detailed_scores_json, finished_at)
                VALUES (?, ?, 'PARTIAL', '{"HV1-41":"falsch"}'::jsonb, '{}'::jsonb, NOW())
                """, UID, examId);
        jdbc.update("""
                INSERT INTO mock_exam_attempts (user_id, exam_id, status) VALUES (?, ?, 'IN_PROGRESS')
                """, UID, examId);
        completedAttempt(OTHER, "{\"HV1-41\":\"richtig\"}", "{}");

        var scores = practice.mockTeilScores(student(UID));

        assertThat(scores).allMatch(s -> s.examId() == examId);
        assertThat(scores).extracting(PracticeDtos.MockTeilScore::key).containsOnly("HOEREN-1");
        assertThat(scores).hasSize(2);
        assertThat(scores).allMatch(s -> s.max() > 0 && s.at() != null);
    }

    private long completedAttempt(long uid, String answers, String detailed) {
        return jdbc.queryForObject("""
                INSERT INTO mock_exam_attempts (user_id, exam_id, status, passed, total_score,
                                                answers_submitted_json, detailed_scores_json)
                VALUES (?, ?, 'COMPLETED', FALSE, 50, ?::jsonb, ?::jsonb) RETURNING id
                """, Long.class, uid, examId, answers, detailed);
    }

    private static User student(long id) {
        User u = mock(User.class);
        when(u.getId()).thenReturn(id);
        when(u.getRole()).thenReturn(User.Role.STUDENT);
        return u;
    }
}
