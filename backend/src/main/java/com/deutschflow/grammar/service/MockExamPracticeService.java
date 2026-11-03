package com.deutschflow.grammar.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.grammar.dto.PracticeDtos;
import com.deutschflow.user.entity.User;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Chế độ LUYỆN ĐỀ telc (03/11/2026): làm từng Teil, không ép giờ, kiểm tra xong có phân tích từng câu.
 * Khác thi thử ở ba điểm — không tạo lượt thi ({@code mock_exam_attempts}), không tính vào lịch sử
 * thi, và Hören tạm thời không có (owner chốt). Điểm, đáp án, phân tích sống ở
 * {@code mock_exam_practice_progress}, mỗi người × đề × Teil một hàng.
 */
@Service
public class MockExamPracticeService {

    public static final String ACCESS_KEY = "practice.telc.access";
    public static final String ALLOWLIST_KEY = "practice.telc.allowlist";
    public static final String WRITING_KEY = "SCHREIBEN-1";

    /** Phần có trong luyện đề. Hören tạm bỏ (chưa có audio cho luyện đề); Sprechen ở module Nói. */
    private static final List<String> SECTIONS = List.of("LESEN", "SPRACHBAUSTEINE", "SCHREIBEN");

    /**
     * Giờ gợi ý từng Teil telc B1: 90 phút cho Leseverstehen + Sprachbausteine chia theo khối lượng,
     * 30 phút cho Schreiben. Chỉ để người học tự đo, không ai bị nộp bài khi hết giờ.
     */
    private static final Map<String, Integer> SUGGEST_MINUTES = Map.of(
            "LESEN-1", 15, "LESEN-2", 20, "LESEN-3", 15,
            "SPRACHBAUSTEINE-1", 10, "SPRACHBAUSTEINE-2", 10, WRITING_KEY, 30);

    private static final int MAX_ELAPSED = 6 * 3600;
    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {};

    private final JdbcTemplate jdbc;
    private final ObjectMapper om;
    private final ExamQuestionSanitizer sanitizer;
    private final MockExamPackService packService;

    public MockExamPracticeService(JdbcTemplate jdbc, ObjectMapper om, ExamQuestionSanitizer sanitizer,
                                   MockExamPackService packService) {
        this.jdbc = jdbc;
        this.om = om;
        this.sanitizer = sanitizer;
        this.packService = packService;
    }

    // ─── cờ truy cập ─────────────────────────────────────────────────────────

    /** Đọc thẳng DB (không qua cache {@code systemConfig}) để owner đổi cờ là có hiệu lực ngay. */
    public boolean hasAccess(User user) {
        if (user == null) return false;
        if (user.getRole() == User.Role.ADMIN) return true;
        String mode = config(ACCESS_KEY, "ALLOWLIST").trim().toUpperCase(Locale.ROOT);
        if ("ALL".equals(mode)) return true;
        if (!"ALLOWLIST".equals(mode)) return false;
        String id = String.valueOf(user.getId());
        String email = user.getEmail() == null ? "" : user.getEmail().trim().toLowerCase(Locale.ROOT);
        for (String token : config(ALLOWLIST_KEY, "").split("[,;\\s]+")) {
            String t = token.trim().toLowerCase(Locale.ROOT);
            if (!t.isEmpty() && (t.equals(id) || t.equals(email))) return true;
        }
        return false;
    }

    public void assertAccess(User user) {
        if (!hasAccess(user)) throw new ForbiddenException("Chế độ luyện đề chưa mở cho tài khoản này.");
    }

    private String config(String key, String fallback) {
        List<String> rows = jdbc.queryForList(
                "SELECT config_value FROM system_config WHERE config_key = ?", String.class, key);
        return rows.isEmpty() || rows.get(0) == null ? fallback : rows.get(0);
    }

    // ─── đề + tiến độ ────────────────────────────────────────────────────────

    public PracticeDtos.Overview overview(User user, long examId) {
        Exam exam = loadExam(user, examId);
        Map<String, Map<String, Object>> progress = progressRows(user.getId(), examId);
        List<PracticeDtos.Teil> teile = new ArrayList<>();
        for (Map.Entry<String, Map<String, Object>> e : practiceTeile(exam.structure()).entrySet()) {
            Map<String, Object> teil = e.getValue();
            String key = e.getKey();
            String section = key.substring(0, key.lastIndexOf('-'));
            int items = teil.get("items") instanceof List<?> l ? l.size() : 0;
            double max = WRITING_KEY.equals(key) ? 45 : maxPoints(teil);
            teile.add(new PracticeDtos.Teil(key, section, teilNumber(teil), str(teil.get("type")), items, max,
                    SUGGEST_MINUTES.get(key), toProgress(progress.get(key))));
        }
        return new PracticeDtos.Overview(exam.id(), exam.title(), exam.level(), exam.format(),
                sanitizer.stripAnswerKey(exam.sectionsJson()), teile);
    }

    public PracticeDtos.Progress saveDraft(User user, long examId, String teilKey, Map<String, String> answers,
                                          Integer elapsed) {
        Exam exam = loadExam(user, examId);
        requireTeil(exam, teilKey);
        Map<String, Map<String, Object>> rows = progressRows(user.getId(), examId);
        Map<String, Object> row = rows.get(teilKey);
        if (row != null && WRITING_KEY.equals(teilKey)) {
            // Viết: sửa bài sau khi chấm vẫn lưu nháp, nhưng giữ phiếu chấm cũ cho tới lần chấm lại.
            jdbc.update("""
                    UPDATE mock_exam_practice_progress
                    SET answers_json = ?::jsonb, elapsed_seconds = GREATEST(elapsed_seconds, ?), updated_at = NOW()
                    WHERE user_id = ? AND exam_id = ? AND teil_key = ?
                    """, json(clean(answers)), clampElapsed(elapsed), user.getId(), examId, teilKey);
            return toProgress(progressRows(user.getId(), examId).get(teilKey));
        }
        if (row != null && Boolean.TRUE.equals(row.get("checked"))) {
            // Teil đã kiểm tra: đáp án đã chấm là nguồn sự thật, nháp đến muộn không được đè lên.
            return toProgress(row);
        }
        upsert(user.getId(), examId, teilKey, json(clean(answers)), false, null, null, clampElapsed(elapsed), null);
        return toProgress(progressRows(user.getId(), examId).get(teilKey));
    }

    public PracticeDtos.Progress check(User user, long examId, String teilKey, Map<String, String> answers,
                                       Integer elapsed) {
        Exam exam = loadExam(user, examId);
        Map<String, Object> teil = requireTeil(exam, teilKey);
        if (WRITING_KEY.equals(teilKey)) throw new BadRequestException("Teil Viết chấm bằng AI, không kiểm tra theo đáp án.");
        Map<String, String> clean = clean(answers);
        PracticeAnalysis.TeilResult result = PracticeAnalysis.analyse(teilKey, teil, notes(examId, teilKey), clean);
        upsert(user.getId(), examId, teilKey, json(clean), true, result.score(), result.max(),
                clampElapsed(elapsed), json(result));
        return toProgress(progressRows(user.getId(), examId).get(teilKey));
    }

    public void reset(User user, long examId, String teilKey) {
        Exam exam = loadExam(user, examId);
        requireTeil(exam, teilKey);
        jdbc.update("DELETE FROM mock_exam_practice_progress WHERE user_id = ? AND exam_id = ? AND teil_key = ?",
                user.getId(), examId, teilKey);
    }

    /** Bối cảnh để chấm Viết: đề bài gửi AI + trình độ. Gọi TRƯỚC khi trừ quota để lỗi đề báo sớm. */
    public WritingTask writingTask(User user, long examId, ExamScoringService scoring) {
        Exam exam = loadExam(user, examId);
        Map<String, Object> teil = requireTeil(exam, WRITING_KEY);
        return new WritingTask(examId, exam.level(), scoring.taskPrompt(teil));
    }

    public record WritingTask(long examId, String level, String prompt) {}

    /** Lưu phiếu chấm AI của bài Viết (gọi từ luồng nền sau khi chấm xong). */
    public void saveWriting(long userId, long examId, String text, Integer elapsed, Map<String, Object> eval) {
        boolean scored = "AI_EVALUATED".equals(eval.get("status"));
        Double score = scored && eval.get("total") instanceof Number n ? n.doubleValue() : null;
        Double max = scored && eval.get("max") instanceof Number m ? m.doubleValue() : null;
        upsert(userId, examId, WRITING_KEY, json(Map.of("text", text == null ? "" : text)), scored, score, max,
                clampElapsed(elapsed), json(eval));
    }

    // ─── nội bộ ──────────────────────────────────────────────────────────────

    private record Exam(long id, String title, String level, String format, String sectionsJson,
                        Map<String, Object> structure) {}

    private Exam loadExam(User user, long examId) {
        assertAccess(user);
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT id, title, cefr_level, exam_format, sections_json::text AS sections_json
                FROM mock_exams WHERE id = ? AND is_active = TRUE
                """, examId);
        if (rows.isEmpty()) throw new NotFoundException("Không tìm thấy đề.");
        packService.assertExamUnlocked(user.getId(), examId);
        packService.assertExamReviewed(examId);
        Map<String, Object> row = rows.get(0);
        if (!"TELC".equalsIgnoreCase(str(row.get("exam_format")))) {
            throw new BadRequestException("Luyện đề hiện chỉ có cho đề telc.");
        }
        String sections = (String) row.get("sections_json");
        return new Exam(examId, str(row.get("title")), str(row.get("cefr_level")), "TELC", sections, read(sections));
    }

    /** Các Teil luyện được, theo thứ tự trong đề. Khoá {@code TÊN_PHẦN-số}. */
    @SuppressWarnings("unchecked")
    static Map<String, Map<String, Object>> practiceTeile(Map<String, Object> structure) {
        Map<String, Map<String, Object>> out = new LinkedHashMap<>();
        if (!(structure.get("sections") instanceof List<?> sections)) return out;
        for (Object s : sections) {
            if (!(s instanceof Map<?, ?> sec)) continue;
            String name = str(sec.get("name"));
            if (name == null || !SECTIONS.contains(name)) continue;
            if (!(sec.get("teile") instanceof List<?> teile)) continue;
            for (Object t : teile) {
                if (t instanceof Map<?, ?> teil) {
                    out.put(name + "-" + teilNumber((Map<String, Object>) teil), (Map<String, Object>) teil);
                }
            }
        }
        return out;
    }

    private Map<String, Object> requireTeil(Exam exam, String teilKey) {
        Map<String, Object> teil = practiceTeile(exam.structure()).get(teilKey);
        if (teil == null) throw new NotFoundException("Đề không có Teil " + teilKey + " trong chế độ luyện.");
        return teil;
    }

    private Map<String, Object> notes(long examId, String teilKey) {
        List<String> rows = jdbc.queryForList(
                "SELECT body::text FROM mock_exam_explanations WHERE exam_id = ? AND teil_key = ?",
                String.class, examId, teilKey);
        return rows.isEmpty() ? Map.of() : read(rows.get(0));
    }

    private Map<String, Map<String, Object>> progressRows(long userId, long examId) {
        Map<String, Map<String, Object>> out = new HashMap<>();
        jdbc.queryForList("""
                SELECT teil_key, answers_json::text AS answers_json, checked, score, max_score,
                       elapsed_seconds, updated_at, result_json::text AS result_json
                FROM mock_exam_practice_progress WHERE user_id = ? AND exam_id = ?
                """, userId, examId).forEach(r -> out.put((String) r.get("teil_key"), r));
        return out;
    }

    private void upsert(long userId, long examId, String teilKey, String answersJson, boolean checked,
                        Double score, Double max, int elapsed, String resultJson) {
        jdbc.update("""
                INSERT INTO mock_exam_practice_progress
                    (user_id, exam_id, teil_key, answers_json, checked, score, max_score, elapsed_seconds,
                     result_json, updated_at, checked_at)
                VALUES (?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?::jsonb, NOW(), CASE WHEN ? THEN NOW() END)
                ON CONFLICT (user_id, exam_id, teil_key) DO UPDATE SET
                    answers_json = EXCLUDED.answers_json, checked = EXCLUDED.checked, score = EXCLUDED.score,
                    max_score = EXCLUDED.max_score,
                    elapsed_seconds = GREATEST(mock_exam_practice_progress.elapsed_seconds, EXCLUDED.elapsed_seconds),
                    result_json = EXCLUDED.result_json, updated_at = NOW(), checked_at = EXCLUDED.checked_at
                """, userId, examId, teilKey, answersJson, checked, score, max, elapsed, resultJson, checked);
    }

    private PracticeDtos.Progress toProgress(Map<String, Object> row) {
        if (row == null) return null;
        Map<String, String> answers = new LinkedHashMap<>();
        read((String) row.get("answers_json")).forEach((k, v) -> answers.put(k, v == null ? null : String.valueOf(v)));
        String resultJson = (String) row.get("result_json");
        Object result = resultJson == null ? null : read(resultJson);
        return new PracticeDtos.Progress(answers, Boolean.TRUE.equals(row.get("checked")),
                number(row.get("score")), number(row.get("max_score")),
                row.get("elapsed_seconds") instanceof Number n ? n.intValue() : 0,
                row.get("updated_at") instanceof Timestamp ts ? ts.toInstant() : null, result);
    }

    private static Map<String, String> clean(Map<String, String> answers) {
        Map<String, String> out = new LinkedHashMap<>();
        if (answers == null) return out;
        answers.forEach((k, v) -> {
            if (k != null && v != null && !v.isBlank() && k.length() <= 40 && v.length() <= 4000) out.put(k, v.trim());
        });
        return out;
    }

    private static int clampElapsed(Integer elapsed) {
        return elapsed == null ? 0 : Math.max(0, Math.min(MAX_ELAPSED, elapsed));
    }

    private static double maxPoints(Map<String, Object> teil) {
        double perItem = teil.get("point_per_item") instanceof Number n ? n.doubleValue() : 1;
        double sum = 0;
        if (teil.get("items") instanceof List<?> items) {
            for (Object o : items) {
                sum += o instanceof Map<?, ?> m && m.get("points") instanceof Number p ? p.doubleValue() : perItem;
            }
        }
        return sum;
    }

    private static int teilNumber(Map<String, Object> teil) {
        return teil.get("teil") instanceof Number n ? n.intValue() : 1;
    }

    private static Double number(Object value) {
        return value instanceof Number n ? n.doubleValue() : null;
    }

    private static String str(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private Map<String, Object> read(String json) {
        if (json == null || json.isBlank()) return new LinkedHashMap<>();
        try {
            return om.readValue(json, MAP);
        } catch (Exception e) {
            throw new IllegalStateException("JSON hỏng trong dữ liệu luyện đề", e);
        }
    }

    private String json(Object value) {
        try {
            return om.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException("Không ghi được JSON luyện đề", e);
        }
    }
}
