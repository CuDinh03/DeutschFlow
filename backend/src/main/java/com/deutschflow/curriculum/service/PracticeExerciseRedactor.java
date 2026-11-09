package com.deutschflow.curriculum.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * A3 (09/11/2026): bản đề luyện kỹ năng "không kèm đáp án" để gửi xuống trình duyệt.
 *
 * <p>{@code practice_node_sessions.exercises_json} là nguyên văn LLM sinh ra: mỗi câu mang luôn
 * khoá đáp án ({@code correct_index}, {@code correct_answer}, {@code accept_also},
 * {@code correct_order}, {@code expected_*}, {@code example_answer}, {@code explanation_*}…).
 * {@code GET /api/skill-tree/practice/{id}} trả nguyên khối đó, nên mở DevTools là thấy đáp án.
 *
 * <p>Ở đây dùng DANH SÁCH TRẮNG (chỉ giữ trường dùng để HIỆN đề) chứ không phải danh sách đen: model
 * có thể tự đặt khoá đáp án mới ({@code answer}, {@code solution}…) và danh sách đen sẽ lọt. Thêm
 * trường hiển thị mới thì phải thêm vào {@link #DISPLAY_KEYS}.
 *
 * <p>Mỗi câu được gắn thêm {@code answer_mode} để client biết dựng ô trả lời nào mà không cần nhìn
 * đáp án (trước đây client suy ra "ô nhập chữ" từ việc {@code correct_answer} là chuỗi). Luật giữ
 * y hệt client cũ: nói → {@code spoken}; có options → {@code choice}; đáp án là chuỗi →
 * {@code text}; còn lại → {@code none}.
 */
public final class PracticeExerciseRedactor {

    private PracticeExerciseRedactor() {
    }

    /** Các dạng bài "nói": học viên tự xác nhận đã đọc (khớp SPEAKING_TYPES của web). */
    public static final Set<String> SPEAKING_TYPES =
            Set.of("SPEAKING_REPEAT", "SPEAKING_RESPONSE", "ROLE_PLAY", "SPEAKING_DESCRIBE");

    /** Trường được phép xuống client TRƯỚC khi nộp bài: chỉ phần đề, không có gì suy ra được đáp án. */
    public static final Set<String> DISPLAY_KEYS = Set.of(
            "type",
            "instruction_de", "instruction_vi",
            // Nghe: trình duyệt đọc transcript bằng TTS nên bắt buộc phải gửi (xem ghi chú PR A3).
            "audio_transcript",
            "question_de", "question_vi",
            "sentence_with_blank", "sentence_de",
            "scenario_de", "scenario_vi", "partner_line_de",
            "situation_de", "situation_vi",
            "statement_de",
            "words",
            "hint_de", "hint_vi",
            "prompt_de", "prompt_vi", "min_words",
            "options",
            "focus_sounds"
    );

    /** Khoá thêm vào mỗi câu đã ẩn đáp án. */
    public static final String ANSWER_MODE = "answer_mode";

    /**
     * Ẩn đáp án khỏi payload session (mảng trần, hoặc object có {@code exercises} + {@code reading_passage}).
     * Payload không đọc được (chuỗi hỏng…) thành mảng rỗng — không bao giờ trả lại nguyên văn.
     */
    public static Object redactPayload(Object payload) {
        if (payload instanceof List<?> list) {
            return redactList(list);
        }
        if (payload instanceof Map<?, ?> map) {
            Map<String, Object> out = new LinkedHashMap<>();
            Object passage = map.get("reading_passage");
            if (passage instanceof Map<?, ?> p) {
                Map<String, Object> cleanPassage = new LinkedHashMap<>();
                copyIfPresent(p, cleanPassage, "text_type");
                copyIfPresent(p, cleanPassage, "text_de");
                out.put("reading_passage", cleanPassage);
            } else if (passage instanceof String s) {
                out.put("reading_passage", s);
            }
            List<?> found = PracticeExerciseGrader.findExercises(map);
            out.put("exercises", found == null ? List.of() : redactList(found));
            return out;
        }
        return List.of();
    }

    /** Mảng câu hỏi bên trong payload (cùng luật tìm như bộ chấm), hoặc rỗng. */
    public static List<?> exercisesOf(Object payload) {
        if (payload instanceof List<?> list) {
            return list;
        }
        if (payload instanceof Map<?, ?> map) {
            List<?> found = PracticeExerciseGrader.findExercises(map);
            return found == null ? List.of() : found;
        }
        return List.of();
    }

    public static Map<String, Object> redactExercise(Map<?, ?> exercise) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (Map.Entry<?, ?> e : exercise.entrySet()) {
            if (e.getKey() instanceof String k && DISPLAY_KEYS.contains(k)) {
                out.put(k, e.getValue());
            }
        }
        out.put(ANSWER_MODE, answerMode(exercise));
        return out;
    }

    /** {@code spoken} | {@code choice} | {@code text} | {@code none} — xem javadoc lớp. */
    public static String answerMode(Map<?, ?> exercise) {
        if (exercise.get("type") instanceof String type && SPEAKING_TYPES.contains(type)) {
            return "spoken";
        }
        if (exercise.get("options") instanceof List<?> options && !options.isEmpty()) {
            return "choice";
        }
        if (exercise.get("correct_answer") instanceof String) {
            return "text";
        }
        return "none";
    }

    private static List<Object> redactList(List<?> list) {
        List<Object> out = new ArrayList<>(list.size());
        for (Object item : list) {
            // Giữ đúng vị trí: client gửi đáp án theo CHỈ SỐ, nên câu hỏng vẫn chiếm một ô (rỗng).
            out.add(item instanceof Map<?, ?> m ? redactExercise(m) : Map.of(ANSWER_MODE, "none"));
        }
        return out;
    }

    private static void copyIfPresent(Map<?, ?> from, Map<String, Object> to, String key) {
        if (from.get(key) != null) {
            to.put(key, from.get(key));
        }
    }
}
