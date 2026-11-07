package com.deutschflow.grammar.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Dừng lượt thi thử giữa chừng (owner chốt 07/11/2026).
 *
 * <p>Bấm "Dừng và lưu phần đã làm" ⇒ lượt chuyển {@code PARTIAL}: chấm theo Teil các Teil đã chạm
 * ({@link MockExamPartialScoring}), Viết dở không chấm, {@code finished_at} là mốc dừng đồng hồ. Lượt dừng
 * KHÔNG có tổng điểm, không đỗ/trượt, không vào B1, chứng nhận, điểm cao nhất, lịch ôn — mọi chỗ đó lọc
 * {@code status = 'COMPLETED'}. Không chạm câu nào ⇒ {@code CANCELLED}, không hiện ở đâu.
 *
 * <p>Đồng hồ của server không phải tiến trình: hạn giờ chỉ là {@code started_at + time_limit}. Lượt bị bỏ
 * dở ngoài ý muốn (đóng tab, hết pin) được chốt LƯỜI khi chính người học quay lại ({@link #closeExpired}
 * ở {@code /start}, {@code /attempts/me}, {@code /exam-plan}) — không có job quét định kỳ, không tốn tải
 * khi không ai dùng.
 */
@Service
@Slf4j
public class MockExamStopService {

    public static final String PARTIAL = "PARTIAL";
    public static final String CANCELLED = "CANCELLED";
    public static final String REASON_STOPPED = "STOPPED";
    public static final String REASON_EXPIRED = "EXPIRED";

    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {};

    private final JdbcTemplate jdbc;
    private final ObjectMapper om;

    public MockExamStopService(JdbcTemplate jdbc, ObjectMapper om) {
        this.jdbc = jdbc;
        this.om = om;
    }

    /** Kết quả dừng. {@code alreadyClosed} = lượt đã nộp/đã dừng trước đó (bấm hai lần, tab khác). */
    public record StopResult(long attemptId, long examId, String status, String reason,
                             MockExamPartialScoring.Summary summary, boolean alreadyClosed) {}

    /**
     * Dừng một lượt đang làm. Quá hạn + ân hạn thì chấm nháp đã lưu trên server, không chấm thân request
     * (cùng luật chống câu giờ của {@code /finish}).
     *
     * @return rỗng khi lượt không tồn tại hoặc không thuộc người học
     */
    @Transactional
    public Optional<StopResult> stop(long uid, long attemptId, Map<String, Object> clientAnswers) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT a.id, a.exam_id, a.status, a.started_at, a.draft_json::text AS draft_json,
                       a.detailed_scores_json::text AS detailed,
                       e.time_limit_minutes, e.sections_json::text AS sections_json
                FROM mock_exam_attempts a JOIN mock_exams e ON e.id = a.exam_id
                WHERE a.id = ? AND a.user_id = ?
                FOR UPDATE OF a
                """, attemptId, uid);
        if (rows.isEmpty()) return Optional.empty();
        Map<String, Object> row = rows.get(0);
        long examId = ((Number) row.get("exam_id")).longValue();
        String status = (String) row.get("status");
        if (!"IN_PROGRESS".equals(status)) {
            Map<String, Object> partial = partialBlock((String) row.get("detailed"));
            return Optional.of(new StopResult(attemptId, examId, status,
                    partial.get("reason") instanceof String r ? r : null, null, true));
        }
        Instant now = Instant.now();
        Instant deadline = MockExamDraftService.deadlineOf((Timestamp) row.get("started_at"),
                (Integer) row.get("time_limit_minutes"));
        Map<String, String> answers = strings(clientAnswers);
        String draft = (String) row.get("draft_json");
        if (deadline != null && now.isAfter(deadline.plus(MockExamDraftService.FINISH_GRACE)) && draft != null) {
            answers = strings(read(draft));
        }
        Instant finishedAt = deadline != null && now.isAfter(deadline) ? deadline : now;
        return Optional.of(close(uid, attemptId, examId, (String) row.get("sections_json"), answers, finishedAt,
                REASON_STOPPED));
    }

    /**
     * Chốt mọi lượt {@code IN_PROGRESS} của người học đã quá hạn + ân hạn, theo nháp cuối trên server.
     * Chạy trong giao dịch riêng: được gọi từ đường đọc (có thể nằm trong giao dịch chỉ đọc).
     * Chỉ quét hàng của MỘT người học qua chỉ mục {@code (user_id, status)}.
     *
     * @return các lượt vừa chốt (thành PARTIAL hoặc CANCELLED)
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public List<StopResult> closeExpired(long uid) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT a.id, a.exam_id, a.started_at, a.draft_json::text AS draft_json,
                       e.time_limit_minutes, e.sections_json::text AS sections_json
                FROM mock_exam_attempts a JOIN mock_exams e ON e.id = a.exam_id
                WHERE a.user_id = ? AND a.status = 'IN_PROGRESS'
                FOR UPDATE OF a SKIP LOCKED
                """, uid);
        if (rows.isEmpty()) return List.of();
        Instant now = Instant.now();
        List<StopResult> closed = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Instant deadline = MockExamDraftService.deadlineOf((Timestamp) row.get("started_at"),
                    (Integer) row.get("time_limit_minutes"));
            if (deadline == null || !now.isAfter(deadline.plus(MockExamDraftService.FINISH_GRACE))) continue;
            long id = ((Number) row.get("id")).longValue();
            long examId = ((Number) row.get("exam_id")).longValue();
            Map<String, String> answers = strings(read((String) row.get("draft_json")));
            StopResult r = close(uid, id, examId, (String) row.get("sections_json"), answers, deadline, REASON_EXPIRED);
            log.info("[MockExam] Lượt {} của user {} quá hạn khi người học vắng mặt ⇒ {}", id, uid, r.status());
            if (!r.alreadyClosed()) closed.add(r);
        }
        return closed;
    }

    private StopResult close(long uid, long attemptId, long examId, String sectionsJson, Map<String, String> answers,
                             Instant finishedAt, String reason) {
        MockExamPartialScoring.Summary summary = MockExamPartialScoring.score(read(sectionsJson), answers);
        String status = summary.touched() ? PARTIAL : CANCELLED;
        int updated = jdbc.update("""
                UPDATE mock_exam_attempts
                SET status = ?, finished_at = ?, total_score = NULL, passed = NULL,
                    detailed_scores_json = ?::jsonb, answers_submitted_json = ?::jsonb
                WHERE id = ? AND user_id = ? AND status = 'IN_PROGRESS'
                """, status, Timestamp.from(finishedAt), json(MockExamPartialScoring.detailedJson(summary, reason)),
                json(answers), attemptId, uid);
        if (updated == 0) {
            // Một lần nộp/dừng khác vừa chốt lượt này — giữ nguyên kết quả đó.
            return new StopResult(attemptId, examId, statusOf(uid, attemptId), reason, null, true);
        }
        return new StopResult(attemptId, examId, status, reason, summary, false);
    }

    private String statusOf(long uid, long attemptId) {
        List<String> s = jdbc.queryForList("SELECT status FROM mock_exam_attempts WHERE id = ? AND user_id = ?",
                String.class, attemptId, uid);
        return s.isEmpty() ? null : s.get(0);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> partialBlock(String detailed) {
        return read(detailed).get("partial") instanceof Map<?, ?> p ? (Map<String, Object>) p : Map.of();
    }

    private Map<String, Object> read(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return om.readValue(json, MAP);
        } catch (Exception e) {
            return Map.of();
        }
    }

    private String json(Object value) {
        try {
            return om.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException("Không ghi được JSON lượt dừng", e);
        }
    }

    private static Map<String, String> strings(Map<String, Object> raw) {
        Map<String, String> out = new LinkedHashMap<>();
        if (raw == null) return out;
        raw.forEach((k, v) -> {
            if (k != null && v != null) out.put(k, String.valueOf(v));
        });
        return out;
    }
}
