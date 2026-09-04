package com.deutschflow.grammar.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Server-side autosave for in-progress mock exam attempts (V285, audit C-02).
 * <p>
 * The attempt row is the source of truth while an exam runs: the client debounce-saves its
 * answer map here, and resume (on any device) restores from it. Writes use an optimistic
 * version ({@code draft_version}) so a stale device gets a 409-style conflict with the newer
 * server draft instead of silently overwriting it. The exam deadline is always derived from
 * {@code started_at + time_limit_minutes} on the server — a client clock or a reload can
 * never extend it.
 */
@Service
public class MockExamDraftService {

    /** Saves are still accepted this long past the deadline (network/debounce slack). */
    public static final Duration SAVE_GRACE = Duration.ofSeconds(120);
    /** Past deadline+grace, /finish scores the server draft instead of the client body. */
    public static final Duration FINISH_GRACE = Duration.ofSeconds(120);
    /** Hard cap on a serialized draft — an answer map should never approach this. */
    public static final int MAX_DRAFT_BYTES = 256 * 1024;

    public enum Outcome { SAVED, VERSION_CONFLICT, ATTEMPT_NOT_IN_PROGRESS, ATTEMPT_EXPIRED, NOT_FOUND, DRAFT_TOO_LARGE }

    /** Draft columns of one attempt row, as last persisted. */
    public record DraftState(String answersJson, Integer sectionIndex, Integer questionIndex,
                             long version, Timestamp savedAt) {
        public boolean exists() { return savedAt != null; }
    }

    public record SaveResult(Outcome outcome, DraftState server, Instant deadlineAt) {}

    /** Answers /finish should score: the client body, or the server draft when past deadline+grace. */
    public record EffectiveAnswers(Map<String, Object> answers, boolean usedServerDraft) {}

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper om = new ObjectMapper();

    public MockExamDraftService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** Deadline of an attempt, or {@code null} when the exam has no time limit. */
    public static Instant deadlineOf(Timestamp startedAt, Integer timeLimitMinutes) {
        if (startedAt == null || timeLimitMinutes == null) return null;
        return startedAt.toInstant().plus(Duration.ofMinutes(timeLimitMinutes));
    }

    /** Seconds left until {@code deadline} (floored at 0), or {@code null} without a deadline. */
    public static Long remainingSeconds(Instant deadlineAt, Instant now) {
        if (deadlineAt == null) return null;
        return Math.max(0, Duration.between(now, deadlineAt).getSeconds());
    }

    /**
     * Optimistic-locked autosave. The UPDATE applies only while the attempt is IN_PROGRESS,
     * belongs to {@code uid} and still has {@code draft_version == baseVersion}; otherwise the
     * caller gets a classified failure with the current server draft to reconcile against.
     */
    public SaveResult save(long uid, long attemptId, String answersJson,
                           Integer sectionIndex, Integer questionIndex,
                           long baseVersion, Instant now) {
        if (answersJson != null && answersJson.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > MAX_DRAFT_BYTES) {
            return new SaveResult(Outcome.DRAFT_TOO_LARGE, null, null);
        }

        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
            SELECT a.status, a.started_at, e.time_limit_minutes
            FROM mock_exam_attempts a
            JOIN mock_exams e ON e.id = a.exam_id
            WHERE a.id = ? AND a.user_id = ?
            """, attemptId, uid);
        if (rows.isEmpty()) return new SaveResult(Outcome.NOT_FOUND, null, null);

        Map<String, Object> meta = rows.get(0);
        Instant deadline = deadlineOf((Timestamp) meta.get("started_at"), (Integer) meta.get("time_limit_minutes"));
        if (!"IN_PROGRESS".equals(meta.get("status"))) {
            return new SaveResult(Outcome.ATTEMPT_NOT_IN_PROGRESS, load(uid, attemptId), deadline);
        }
        if (deadline != null && now.isAfter(deadline.plus(SAVE_GRACE))) {
            return new SaveResult(Outcome.ATTEMPT_EXPIRED, load(uid, attemptId), deadline);
        }

        List<Map<String, Object>> updated = jdbcTemplate.queryForList("""
            UPDATE mock_exam_attempts
            SET draft_json = ?::jsonb,
                draft_section_index = ?,
                draft_question_index = ?,
                draft_version = draft_version + 1,
                draft_saved_at = NOW()
            WHERE id = ? AND user_id = ? AND status = 'IN_PROGRESS' AND draft_version = ?
            RETURNING draft_version, draft_saved_at
            """, answersJson, sectionIndex, questionIndex, attemptId, uid, baseVersion);

        if (updated.isEmpty()) {
            // Raced by another device (or a finish): report the winning server state.
            DraftState server = load(uid, attemptId);
            return new SaveResult(Outcome.VERSION_CONFLICT, server, deadline);
        }
        Map<String, Object> row = updated.get(0);
        DraftState saved = new DraftState(answersJson, sectionIndex, questionIndex,
                ((Number) row.get("draft_version")).longValue(), (Timestamp) row.get("draft_saved_at"));
        return new SaveResult(Outcome.SAVED, saved, deadline);
    }

    /** Current draft columns of the attempt, or {@code null} when the attempt doesn't exist. */
    public DraftState load(long uid, long attemptId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
            SELECT draft_json::text AS draft_json, draft_section_index, draft_question_index,
                   draft_version, draft_saved_at
            FROM mock_exam_attempts
            WHERE id = ? AND user_id = ?
            """, attemptId, uid);
        if (rows.isEmpty()) return null;
        Map<String, Object> r = rows.get(0);
        return new DraftState(
                (String) r.get("draft_json"),
                (Integer) r.get("draft_section_index"),
                (Integer) r.get("draft_question_index"),
                ((Number) r.get("draft_version")).longValue(),
                (Timestamp) r.get("draft_saved_at"));
    }

    /**
     * Deadline enforcement for /finish: within deadline+grace the client body wins (normal
     * submit). Past it, a client could have held answers back to buy time, so the last
     * server-autosaved draft is scored instead when one exists. Without a draft there is
     * nothing better than the body — accept it and let the caller log the anomaly.
     */
    @SuppressWarnings("unchecked")
    public EffectiveAnswers effectiveAnswersForFinish(long uid, long attemptId,
                                                      Map<String, Object> clientAnswers, Instant now) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
            SELECT a.started_at, e.time_limit_minutes, a.draft_json::text AS draft_json
            FROM mock_exam_attempts a
            JOIN mock_exams e ON e.id = a.exam_id
            WHERE a.id = ? AND a.user_id = ?
            """, attemptId, uid);
        if (rows.isEmpty()) return new EffectiveAnswers(clientAnswers, false);

        Map<String, Object> meta = rows.get(0);
        Instant deadline = deadlineOf((Timestamp) meta.get("started_at"), (Integer) meta.get("time_limit_minutes"));
        String draftJson = (String) meta.get("draft_json");
        if (deadline == null || !now.isAfter(deadline.plus(FINISH_GRACE)) || draftJson == null) {
            return new EffectiveAnswers(clientAnswers, false);
        }
        try {
            Map<String, Object> draftAnswers = om.readValue(draftJson, Map.class);
            return new EffectiveAnswers(draftAnswers, true);
        } catch (Exception e) {
            // A corrupt draft must never block finishing — fall back to the client body.
            return new EffectiveAnswers(clientAnswers, false);
        }
    }
}
