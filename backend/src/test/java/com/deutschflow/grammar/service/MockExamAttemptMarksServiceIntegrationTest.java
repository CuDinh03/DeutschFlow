package com.deutschflow.grammar.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Đánh dấu bài đọc theo lượt thi thử (đợt 2, 10/11/2026) trên PostgreSQL thật — ca EXAM-204…207: đang thi
 * thì server bỏ gắn câu + ghi chú; lượt mới không mang đánh dấu lượt cũ; lưu đánh dấu không đụng khoá
 * phiên bản của nháp đáp án; xem lại sau khi nộp thì sửa được đủ. Không @MockBean.
 */
@SpringBootTest
@DisplayName("MockExamAttemptMarksService Integration Tests (đánh dấu bài đọc — thi thử)")
class MockExamAttemptMarksServiceIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final long UID = 990_912L;
    private static final String CTX = "Wer zu uns kommt, fragt zuerst nach dem Zeitaufwand.";
    private static final String SECTIONS = """
            {"sections":[
              {"name":"LESEN","teile":[
                {"teil":2,"type":"MULTIPLE_CHOICE","point_per_item":5,
                 "context":"%s",
                 "items":[{"id":"LV2-6","question":"Wer kommt, fragt …","correct":"a",
                           "options":{"a":"x","b":"y","c":"z"}}]}]}]}
            """.formatted(CTX);

    @Autowired private MockExamAttemptMarksService service;
    @Autowired private MockExamDraftService drafts;
    @Autowired private JdbcTemplate jdbc;

    @BeforeEach
    void user() {
        for (long id : new long[] {UID, UID + 1}) {
            jdbc.update("""
                    INSERT INTO users (id, email, password_hash, display_name, role, created_at)
                    VALUES (?, ?, 'x', 'Học viên đánh dấu', 'STUDENT', NOW())
                    ON CONFLICT (id) DO NOTHING
                    """, id, "marks-" + id + "@test.local");
        }
    }

    private long newExam() {
        return jdbc.queryForObject("""
                INSERT INTO mock_exams (cefr_level, title, sections_json, time_limit_minutes)
                VALUES ('B1', 'Marks IT exam', ?::jsonb, 150) RETURNING id
                """, Long.class, SECTIONS);
    }

    private long newAttempt(long examId, String status) {
        return jdbc.queryForObject("""
                INSERT INTO mock_exam_attempts (user_id, exam_id, status) VALUES (?, ?, ?) RETURNING id
                """, Long.class, UID, examId, status);
    }

    /** Một nhóm tô vàng "Zeitaufwand", gắn câu LV2-6 + ghi chú, gạch bỏ phương án b. */
    private static Map<String, Object> pack() {
        int s = CTX.indexOf("Zeitaufwand");
        Map<String, Object> mark = new LinkedHashMap<>();
        mark.put("id", "h1");
        mark.put("g", "g1");
        mark.put("b", "ctx");
        mark.put("s", s);
        mark.put("e", s + "Zeitaufwand".length());
        mark.put("k", "hl");
        mark.put("c", "y");
        mark.put("q", "LV2-6");
        mark.put("n", "từ khoá");
        return Map.of("marks", List.of(mark), "struck", Map.of("LV2-6", List.of("b")));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> firstMark(Map<String, Object> marks) {
        return ((List<Map<String, Object>>) marks.get("marks")).get(0);
    }

    @Test
    @DisplayName("đang thi ⇒ lưu màu + gạch bỏ, server bỏ gắn câu và ghi chú (EXAM-204)")
    void inProgressStripsTagAndNote() {
        long attempt = newAttempt(newExam(), "IN_PROGRESS");

        var saved = service.save(UID, attempt, "LESEN-2", pack());

        Map<String, Object> m = firstMark(saved.marks());
        assertThat(m.get("c")).isEqualTo("y");
        assertThat(m.get("q")).isNull();
        assertThat(m.get("n")).isEqualTo("");
        assertThat(saved.marks().get("struck")).isEqualTo(Map.of("LV2-6", List.of("b")));
        assertThat(saved.updatedAt()).isNotNull();
        assertThat(firstMark(service.marks(UID, attempt, "LESEN-2").marks()).get("q")).isNull();
    }

    @Test
    @DisplayName("đã nộp / dừng giữa chừng ⇒ xem lại sửa được đủ, kể cả gắn câu + ghi chú (EXAM-207)")
    void reviewKeepsTagAndNote() {
        long exam = newExam();
        for (String status : List.of("COMPLETED", MockExamStopService.PARTIAL)) {
            long attempt = newAttempt(exam, status);
            Map<String, Object> m = firstMark(service.save(UID, attempt, "LESEN-2", pack()).marks());
            assertThat(m.get("q")).isEqualTo("LV2-6");
            assertThat(m.get("n")).isEqualTo("từ khoá");
        }
    }

    @Test
    @DisplayName("lượt mới không mang đánh dấu lượt cũ; luyện Teil cùng đề không lẫn (EXAM-205)")
    void marksArePerAttempt() {
        long exam = newExam();
        long first = newAttempt(exam, "COMPLETED");
        service.save(UID, first, "LESEN-2", pack());
        long second = newAttempt(exam, "IN_PROGRESS");

        assertThat(service.marks(UID, second, "LESEN-2").marks()).isEmpty();
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM exam_passage_marks WHERE user_id = ? AND exam_id = ? AND attempt_id IS NULL
                """, Integer.class, UID, exam)).isZero();
    }

    @Test
    @DisplayName("lưu đánh dấu không đổi phiên bản nháp đáp án ⇒ nháp không 409 (EXAM-206)")
    void marksDoNotTouchDraftVersion() {
        long attempt = newAttempt(newExam(), "IN_PROGRESS");
        assertThat(drafts.save(UID, attempt, "{\"LV2-6\":\"a\"}", 0, 0, 0L, Instant.now()).outcome())
                .isEqualTo(MockExamDraftService.Outcome.SAVED);

        service.save(UID, attempt, "LESEN-2", pack());
        service.save(UID, attempt, "LESEN-2", pack());

        assertThat(drafts.save(UID, attempt, "{\"LV2-6\":\"c\"}", 0, 0, 1L, Instant.now()).outcome())
                .isEqualTo(MockExamDraftService.Outcome.SAVED);
    }

    @Test
    @DisplayName("lượt người khác ⇒ 404; lượt huỷ ⇒ 409; Teil lạ ⇒ 404; gói sai ⇒ 400")
    void guards() {
        long exam = newExam();
        long mine = newAttempt(exam, "IN_PROGRESS");
        long cancelled = newAttempt(exam, "CANCELLED");

        assertThatThrownBy(() -> service.marks(UID + 1, mine, "LESEN-2")).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.save(UID + 1, mine, "LESEN-2", pack())).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.save(UID, cancelled, "LESEN-2", pack())).isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> service.marks(UID, mine, "LESEN-9")).isInstanceOf(NotFoundException.class);
        Map<String, Object> bad = Map.of("marks", List.of(Map.of("id", "h1", "g", "g1", "b", "ctx", "s", 5, "e", 2, "k", "hl", "c", "y")));
        assertThatThrownBy(() -> service.save(UID, mine, "LESEN-2", bad)).isInstanceOf(BadRequestException.class);
    }
}
