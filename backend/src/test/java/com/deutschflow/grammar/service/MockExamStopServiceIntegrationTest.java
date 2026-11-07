package com.deutschflow.grammar.service;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Dừng lượt thi thử giữa chừng (07/11/2026) trên PostgreSQL thật: PARTIAL chỉ chấm Teil đã chạm, lượt
 * rỗng thành CANCELLED, dừng hai lần không ghi đè, lượt bỏ dở quá hạn được chốt lười theo nháp với
 * {@code finished_at} = hạn giờ. Cùng idiom với {@code MockExamDraftServiceIntegrationTest} (không @MockBean).
 */
@SpringBootTest
@DisplayName("MockExamStopService Integration Tests (dừng giữa chừng)")
class MockExamStopServiceIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final long UID = 990_711L;
    private static final String SECTIONS = """
            {"sections":[
              {"name":"LESEN","teile":[
                {"teil":1,"type":"MULTIPLE_CHOICE","point_per_item":5,"items":[
                  {"id":"L1-1","correct":"a","options":{"a":"x","b":"y"}},
                  {"id":"L1-2","correct":"b","options":{"a":"x","b":"y"}}]},
                {"teil":2,"type":"MULTIPLE_CHOICE","point_per_item":5,"items":[
                  {"id":"L2-1","correct":"a","options":{"a":"x","b":"y"}}]}]},
              {"name":"SCHREIBEN","teile":[{"teil":1,"type":"EMAIL"}]}]}
            """;

    @Autowired private MockExamStopService service;
    @Autowired private JdbcTemplate jdbc;

    private long newExam(int minutes) {
        return jdbc.queryForObject("""
                INSERT INTO mock_exams (cefr_level, title, sections_json, time_limit_minutes)
                VALUES ('B1', 'Stop IT exam', ?::jsonb, ?) RETURNING id
                """, Long.class, SECTIONS, minutes);
    }

    private long newAttempt(long examId) {
        return jdbc.queryForObject("""
                INSERT INTO mock_exam_attempts (user_id, exam_id, status) VALUES (?, ?, 'IN_PROGRESS') RETURNING id
                """, Long.class, UID, examId);
    }

    private Map<String, Object> row(long attemptId) {
        return jdbc.queryForMap("""
                SELECT status, total_score, passed, finished_at, detailed_scores_json::text AS detailed
                FROM mock_exam_attempts WHERE id = ?
                """, attemptId);
    }

    @Test
    @DisplayName("dừng sau khi làm Lesen T1 ⇒ PARTIAL, chỉ T1 có điểm, không tổng điểm, không đỗ/trượt")
    void stopScoresOnlyTouchedTeile() {
        long id = newAttempt(newExam(150));

        var r = service.stop(UID, id, Map.of("L1-1", "a", "email_1", "Liebe Anna")).orElseThrow();

        assertThat(r.status()).isEqualTo(MockExamStopService.PARTIAL);
        assertThat(r.alreadyClosed()).isFalse();
        assertThat(r.summary().teileCounted()).isEqualTo(1);
        assertThat(r.summary().teileDone()).isEqualTo(2); // Lesen T1 + Viết đã viết (không chấm)
        Map<String, Object> db = row(id);
        assertThat(db.get("status")).isEqualTo("PARTIAL");
        assertThat(db.get("total_score")).isNull();
        assertThat(db.get("passed")).isNull();
        assertThat(db.get("finished_at")).isNotNull();
        assertThat((String) db.get("detailed")).contains("\"LESEN-1\"").contains("\"WRITTEN_NOT_GRADED\"").contains("\"STOPPED\"");
    }

    @Test
    @DisplayName("dừng khi chưa chạm câu nào ⇒ CANCELLED")
    void stopWithoutAnswersCancels() {
        long id = newAttempt(newExam(150));

        var r = service.stop(UID, id, Map.of()).orElseThrow();

        assertThat(r.status()).isEqualTo(MockExamStopService.CANCELLED);
        assertThat(row(id).get("status")).isEqualTo("CANCELLED");
    }

    @Test
    @DisplayName("dừng lần hai / lượt đã nộp ⇒ already_closed, không ghi đè")
    void secondStopIsIdempotent() {
        long id = newAttempt(newExam(150));
        service.stop(UID, id, Map.of("L1-1", "a"));

        var again = service.stop(UID, id, Map.of("L1-1", "b", "L1-2", "b", "L2-1", "a")).orElseThrow();

        assertThat(again.alreadyClosed()).isTrue();
        assertThat(again.status()).isEqualTo("PARTIAL");
        assertThat((String) row(id).get("detailed")).contains("\"teile_done\": 1");
    }

    @Test
    @DisplayName("lượt của người khác ⇒ rỗng (404)")
    void foreignAttemptIsNotFound() {
        long id = newAttempt(newExam(150));

        assertThat(service.stop(UID + 1, id, Map.of("L1-1", "a"))).isEmpty();
        assertThat(row(id).get("status")).isEqualTo("IN_PROGRESS");
    }

    @Test
    @DisplayName("bỏ dở quá hạn ⇒ chốt lười theo nháp, finished_at = hạn giờ; còn giờ thì không đụng")
    void closeExpiredUsesDraftAndDeadline() {
        long exam = newExam(60);
        long expired = newAttempt(exam);
        jdbc.update("""
                UPDATE mock_exam_attempts SET started_at = NOW() - INTERVAL '3 hours',
                       draft_json = '{"L2-1":"a"}'::jsonb, draft_saved_at = NOW() - INTERVAL '150 minutes'
                WHERE id = ?""", expired);
        long running = newAttempt(exam);

        var closed = service.closeExpired(UID);

        assertThat(closed).extracting(MockExamStopService.StopResult::attemptId).containsExactly(expired);
        Map<String, Object> db = row(expired);
        assertThat(db.get("status")).isEqualTo("PARTIAL");
        assertThat((String) db.get("detailed")).contains("\"EXPIRED\"").contains("\"LESEN-2\"");
        Timestamp started = jdbc.queryForObject("SELECT started_at FROM mock_exam_attempts WHERE id = ?", Timestamp.class, expired);
        assertThat(((Timestamp) db.get("finished_at")).toInstant()).isEqualTo(started.toInstant().plusSeconds(3600));
        assertThat(row(running).get("status")).isEqualTo("IN_PROGRESS");
        assertThat(service.closeExpired(UID)).isEmpty();
    }
}
