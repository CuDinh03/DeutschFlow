package com.deutschflow.grammar.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.grammar.dto.PracticeDtos;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Đánh dấu bài đọc theo LƯỢT thi thử (đợt 2, 10/11/2026) — {@code exam_passage_marks} có {@code attempt_id}.
 *
 * <ul>
 *   <li>Lượt {@code IN_PROGRESS}: chế độ thi ({@link PassageMarksValidator.Mode#EXAM}) — chỉ màu, gạch chân,
 *       gạch bỏ đáp án; server bỏ gắn câu + ghi chú dù client có gửi (owner chốt 09/11/2026).</li>
 *   <li>Lượt đã nộp ({@code COMPLETED}) hoặc dừng giữa chừng ({@code PARTIAL}): xem lại — sửa được, đủ công cụ
 *       kể cả gắn câu + ghi chú (owner chốt: chỉ phục vụ ôn tập, không đụng điểm).</li>
 *   <li>Lượt huỷ ({@code CANCELLED}) không hiện ở đâu ⇒ không ghi (409).</li>
 * </ul>
 *
 * <p>Lưu riêng với nháp đáp án ({@code mock_exam_attempts.draft_json} có khoá phiên bản): hai luồng lưu độc lập,
 * lưu đánh dấu không bao giờ làm nháp đáp án 409. Chỉ chủ lượt đọc/ghi được; lượt của người khác ⇒ 404.
 */
@Service
public class MockExamAttemptMarksService {

    static final String IN_PROGRESS = "IN_PROGRESS";
    private static final Set<String> REVIEWABLE = Set.of("COMPLETED", MockExamStopService.PARTIAL);
    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {};

    private final JdbcTemplate jdbc;
    private final ObjectMapper om;

    public MockExamAttemptMarksService(JdbcTemplate jdbc, ObjectMapper om) {
        this.jdbc = jdbc;
        this.om = om;
    }

    public PracticeDtos.Marks marks(long userId, long attemptId, String teilKey) {
        Attempt a = attempt(userId, attemptId);
        requireTeil(a, teilKey);
        return row(attemptId, teilKey);
    }

    /** Ghi đè cả gói (lần lưu sau thắng). Chế độ theo trạng thái lượt, không theo client. */
    public PracticeDtos.Marks save(long userId, long attemptId, String teilKey, Map<String, Object> raw) {
        Attempt a = attempt(userId, attemptId);
        Map<String, Object> teil = requireTeil(a, teilKey);
        PassageMarksValidator.Mode mode;
        if (IN_PROGRESS.equals(a.status())) mode = PassageMarksValidator.Mode.EXAM;
        else if (REVIEWABLE.contains(a.status())) mode = PassageMarksValidator.Mode.FULL;
        else throw new ConflictException("Lượt thi này không còn ghi đánh dấu được.");
        Map<String, Object> clean = PassageMarksValidator.clean(raw, PassageMarksValidator.blocksOf(teil),
                itemIds(teil), PassageMarksValidator.optionsOf(teil), mode);
        String body = json(clean);
        if (body.getBytes(StandardCharsets.UTF_8).length > PassageMarksValidator.MAX_JSON_BYTES) {
            throw new BadRequestException("Gói đánh dấu quá lớn.");
        }
        jdbc.update("""
                INSERT INTO exam_passage_marks (user_id, exam_id, teil_key, attempt_id, marks_json, updated_at)
                VALUES (?, ?, ?, ?, ?::jsonb, NOW())
                ON CONFLICT (attempt_id, teil_key) WHERE attempt_id IS NOT NULL
                DO UPDATE SET marks_json = EXCLUDED.marks_json, updated_at = NOW()
                """, userId, a.examId(), teilKey, attemptId, body);
        return row(attemptId, teilKey);
    }

    private record Attempt(long id, long examId, String status, Map<String, Object> structure) {}

    private Attempt attempt(long userId, long attemptId) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT a.id, a.exam_id, a.status, e.sections_json::text AS sections_json
                FROM mock_exam_attempts a JOIN mock_exams e ON e.id = a.exam_id
                WHERE a.id = ? AND a.user_id = ?
                """, attemptId, userId);
        if (rows.isEmpty()) throw new NotFoundException("Không tìm thấy lượt thi.");
        Map<String, Object> r = rows.get(0);
        return new Attempt(attemptId, ((Number) r.get("exam_id")).longValue(), (String) r.get("status"),
                read((String) r.get("sections_json")));
    }

    private static Map<String, Object> requireTeil(Attempt a, String teilKey) {
        Map<String, Object> teil = MockExamPracticeService.practiceTeile(a.structure()).get(teilKey);
        if (teil == null) throw new NotFoundException("Đề không có Teil " + teilKey + ".");
        return teil;
    }

    private PracticeDtos.Marks row(long attemptId, String teilKey) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT marks_json::text AS marks_json, updated_at FROM exam_passage_marks
                WHERE attempt_id = ? AND teil_key = ?
                """, attemptId, teilKey);
        if (rows.isEmpty()) return new PracticeDtos.Marks(Map.of(), null);
        Map<String, Object> r = rows.get(0);
        return new PracticeDtos.Marks(read((String) r.get("marks_json")),
                r.get("updated_at") instanceof Timestamp ts ? ts.toInstant() : null);
    }

    private static Set<String> itemIds(Map<String, Object> teil) {
        Set<String> ids = new LinkedHashSet<>();
        if (teil.get("items") instanceof List<?> items) {
            for (Object o : items) {
                if (o instanceof Map<?, ?> item && item.get("id") != null) ids.add(String.valueOf(item.get("id")));
            }
        }
        return ids;
    }

    private Map<String, Object> read(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return om.readValue(json, MAP);
        } catch (Exception e) {
            return Map.of();
        }
    }

    private String json(Object o) {
        try {
            return om.writeValueAsString(o);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
