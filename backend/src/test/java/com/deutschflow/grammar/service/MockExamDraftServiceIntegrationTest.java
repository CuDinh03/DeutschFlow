package com.deutschflow.grammar.service;

import com.deutschflow.grammar.service.MockExamDraftService.DraftState;
import com.deutschflow.grammar.service.MockExamDraftService.EffectiveAnswers;
import com.deutschflow.grammar.service.MockExamDraftService.Outcome;
import com.deutschflow.grammar.service.MockExamDraftService.SaveResult;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V285 autosave (audit C-02) against a real PostgreSQL: proves the migration applies, the
 * optimistic-lock UPDATE serializes concurrent devices, the server-computed deadline gates
 * both saves and /finish answers, and resume reads back exactly what was saved. These are
 * the guarantees mocked-JdbcTemplate unit tests cannot give.
 */
@SpringBootTest
@DisplayName("MockExamDraftService Integration Tests (V285 autosave)")
class MockExamDraftServiceIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final long UID = 990_285L;

    @Autowired private MockExamDraftService service;
    @Autowired private JdbcTemplate jdbc;

    private long newExam(Integer timeLimitMinutes) {
        return jdbc.queryForObject("""
            INSERT INTO mock_exams (cefr_level, title, sections_json, time_limit_minutes)
            VALUES ('A1', 'Draft IT exam', '{"sections":[]}'::jsonb, ?)
            RETURNING id
            """, Long.class, timeLimitMinutes);
    }

    private long newAttempt(long examId, long uid) {
        return jdbc.queryForObject("""
            INSERT INTO mock_exam_attempts (user_id, exam_id, status)
            VALUES (?, ?, 'IN_PROGRESS')
            RETURNING id
            """, Long.class, uid, examId);
    }

    /** Backdates the attempt so the server-derived deadline lands in the past. */
    private void backdateStart(long attemptId, int minutesAgo) {
        jdbc.update("UPDATE mock_exam_attempts SET started_at = NOW() - (? * INTERVAL '1 minute') WHERE id = ?",
                minutesAgo, attemptId);
    }

    @Test
    @DisplayName("fresh save persists the draft and bumps version 0 → 1; load reads it back")
    void freshSaveRoundTrips() {
        long attemptId = newAttempt(newExam(90), UID);

        SaveResult r = service.save(UID, attemptId, "{\"q1\":\"a\"}", 0, 2, 0L, Instant.now());

        assertThat(r.outcome()).isEqualTo(Outcome.SAVED);
        assertThat(r.server().version()).isEqualTo(1L);
        assertThat(r.server().savedAt()).isNotNull();
        assertThat(r.deadlineAt()).isNotNull();

        DraftState loaded = service.load(UID, attemptId);
        assertThat(loaded.exists()).isTrue();
        assertThat(loaded.answersJson()).contains("\"q1\"");
        assertThat(loaded.sectionIndex()).isEqualTo(0);
        assertThat(loaded.questionIndex()).isEqualTo(2);
        assertThat(loaded.version()).isEqualTo(1L);
    }

    @Test
    @DisplayName("stale baseVersion loses: VERSION_CONFLICT returns the newer server draft, nothing overwritten")
    void staleVersionConflictsInsteadOfOverwriting() {
        long attemptId = newAttempt(newExam(90), UID);

        assertThat(service.save(UID, attemptId, "{\"q1\":\"device-A\"}", 0, 0, 0L, Instant.now()).outcome())
                .isEqualTo(Outcome.SAVED); // v1
        assertThat(service.save(UID, attemptId, "{\"q1\":\"device-A2\"}", 0, 1, 1L, Instant.now()).outcome())
                .isEqualTo(Outcome.SAVED); // v2

        // Device B still believes v1 → must NOT clobber v2.
        SaveResult stale = service.save(UID, attemptId, "{\"q1\":\"device-B\"}", 0, 0, 1L, Instant.now());

        assertThat(stale.outcome()).isEqualTo(Outcome.VERSION_CONFLICT);
        assertThat(stale.server().version()).isEqualTo(2L);
        assertThat(stale.server().answersJson()).contains("device-A2");
        assertThat(service.load(UID, attemptId).answersJson()).contains("device-A2");
    }

    @Test
    @DisplayName("completed attempt refuses saves (ATTEMPT_NOT_IN_PROGRESS)")
    void completedAttemptRefusesSaves() {
        long attemptId = newAttempt(newExam(90), UID);
        jdbc.update("UPDATE mock_exam_attempts SET status = 'COMPLETED' WHERE id = ?", attemptId);

        SaveResult r = service.save(UID, attemptId, "{\"q1\":\"late\"}", 0, 0, 0L, Instant.now());

        assertThat(r.outcome()).isEqualTo(Outcome.ATTEMPT_NOT_IN_PROGRESS);
    }

    @Test
    @DisplayName("past deadline+grace the save is rejected (ATTEMPT_EXPIRED) — clock cheating can't extend it")
    void expiredAttemptRefusesSaves() {
        long attemptId = newAttempt(newExam(60), UID);
        backdateStart(attemptId, 60 + 5); // deadline 5 min gone > 120s grace

        SaveResult r = service.save(UID, attemptId, "{\"q1\":\"late\"}", 0, 0, 0L, Instant.now());

        assertThat(r.outcome()).isEqualTo(Outcome.ATTEMPT_EXPIRED);
        assertThat(r.deadlineAt()).isBefore(Instant.now());
    }

    @Test
    @DisplayName("exam without time limit never expires")
    void noTimeLimitNeverExpires() {
        long attemptId = newAttempt(newExam(null), UID);
        backdateStart(attemptId, 60 * 24); // a day old

        SaveResult r = service.save(UID, attemptId, "{\"q1\":\"slow\"}", 0, 0, 0L, Instant.now());

        assertThat(r.outcome()).isEqualTo(Outcome.SAVED);
        assertThat(r.deadlineAt()).isNull();
    }

    @Test
    @DisplayName("another user's attempt is NOT_FOUND (no cross-user reads or writes)")
    void otherUsersAttemptIsNotFound() {
        long attemptId = newAttempt(newExam(90), UID);

        assertThat(service.save(UID + 1, attemptId, "{\"q1\":\"x\"}", 0, 0, 0L, Instant.now()).outcome())
                .isEqualTo(Outcome.NOT_FOUND);
        assertThat(service.load(UID + 1, attemptId)).isNull();
    }

    @Test
    @DisplayName("oversized draft is rejected before touching the DB")
    void oversizedDraftRejected() {
        long attemptId = newAttempt(newExam(90), UID);
        String huge = "{\"blob\":\"" + "x".repeat(MockExamDraftService.MAX_DRAFT_BYTES) + "\"}";

        assertThat(service.save(UID, attemptId, huge, 0, 0, 0L, Instant.now()).outcome())
                .isEqualTo(Outcome.DRAFT_TOO_LARGE);
        assertThat(service.load(UID, attemptId).exists()).isFalse();
    }

    @Test
    @DisplayName("/finish within the deadline scores the client body")
    void finishWithinDeadlineUsesClientBody() {
        long attemptId = newAttempt(newExam(90), UID);
        service.save(UID, attemptId, "{\"q1\":\"draft\"}", 0, 0, 0L, Instant.now());

        EffectiveAnswers e = service.effectiveAnswersForFinish(
                UID, attemptId, Map.of("q1", "client"), Instant.now());

        assertThat(e.usedServerDraft()).isFalse();
        assertThat(e.answers()).containsEntry("q1", "client");
    }

    @Test
    @DisplayName("/finish past deadline+grace scores the server draft, not the client body")
    void finishPastDeadlineUsesServerDraft() {
        long attemptId = newAttempt(newExam(60), UID);
        service.save(UID, attemptId, "{\"q1\":\"saved-in-time\"}", 0, 0, 0L, Instant.now());
        backdateStart(attemptId, 60 + 10);

        EffectiveAnswers e = service.effectiveAnswersForFinish(
                UID, attemptId, Map.of("q1", "smuggled-late"), Instant.now());

        assertThat(e.usedServerDraft()).isTrue();
        assertThat(e.answers()).containsEntry("q1", "saved-in-time");
    }

    @Test
    @DisplayName("/finish past deadline WITHOUT a draft falls back to the client body")
    void finishPastDeadlineWithoutDraftFallsBack() {
        long attemptId = newAttempt(newExam(60), UID);
        backdateStart(attemptId, 60 + 10);

        EffectiveAnswers e = service.effectiveAnswersForFinish(
                UID, attemptId, Map.of("q1", "only-copy"), Instant.now());

        assertThat(e.usedServerDraft()).isFalse();
        assertThat(e.answers()).containsEntry("q1", "only-copy");
    }
}
