package com.deutschflow.curriculum.service;

import com.deutschflow.common.exception.ConflictException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * A3 (09/11/2026): luồng luyện kỹ năng (Hören/Sprechen/Lesen/Schreiben) KHÔNG gửi đáp án xuống
 * trình duyệt trước khi học viên trả lời.
 *
 * <ul>
 *   <li>{@link #quiz} — đề đã ẩn đáp án (GET, chỉ đọc).</li>
 *   <li>{@link #check} — chấm từng câu VỪA trả lời, trả đúng/sai + phương án đúng của câu trắc
 *       nghiệm (POST, không ghi DB, không gọi AI). Đáp án dạng chữ và giải thích KHÔNG trả ở đây —
 *       chúng chỉ lộ sau khi nộp cả bài (product 18/08), qua {@link #review}.</li>
 *   <li>{@link #review} — toàn bộ đáp án + giải thích, CHỈ khi session đã COMPLETED (GET, chỉ đọc).</li>
 * </ul>
 *
 * <p>Quyền sở hữu: mọi đường đều đi qua {@link PracticeNodeService#getSessionDetail}, vốn lọc
 * {@code WHERE id = ? AND user_id = ?} → session của người khác là 404.
 *
 * <p>Không sửa {@link PracticeNodeService}: API cũ {@code GET /api/skill-tree/practice/{id}} giữ
 * nguyên (vẫn kèm đáp án) cho tới khi tắt hẳn.
 */
@Service
@RequiredArgsConstructor
public class PracticeSessionQuizService {

    private final PracticeNodeService practiceNodeService;

    /** Đề của session, đã ẩn đáp án. Chỉ đọc. */
    public Map<String, Object> quiz(long userId, long sessionId) {
        Map<String, Object> detail = practiceNodeService.getSessionDetail(userId, sessionId);
        Map<String, Object> out = new LinkedHashMap<>(detail);
        out.put("exercises", PracticeExerciseRedactor.redactPayload(detail.get("exercises")));
        return out;
    }

    /**
     * Chấm các câu học viên vừa trả lời. {@code answers}: chỉ số câu ("0", "1"…) → đáp án thô
     * (số thứ tự phương án, chuỗi, hoặc {@code "spoken"}), cùng dạng {@code answers} mà /submit nhận.
     * Chỉ số không hợp lệ bị bỏ qua. Không ghi gì: điểm chính thức vẫn do /submit chấm lại.
     */
    public Map<String, Object> check(long userId, long sessionId, Map<String, Object> answers) {
        Map<String, Object> detail = practiceNodeService.getSessionDetail(userId, sessionId);
        List<?> exercises = PracticeExerciseRedactor.exercisesOf(detail.get("exercises"));

        Map<String, Object> results = new LinkedHashMap<>();
        if (answers != null) {
            for (Map.Entry<String, Object> entry : answers.entrySet()) {
                int index;
                try {
                    index = Integer.parseInt(entry.getKey());
                } catch (NumberFormatException e) {
                    continue;
                }
                if (index < 0 || index >= exercises.size()
                        || !(exercises.get(index) instanceof Map<?, ?> raw)) {
                    continue;
                }
                @SuppressWarnings("unchecked")
                Map<String, Object> exercise = (Map<String, Object>) raw;
                Object cell = entry.getValue();
                Object submitted = cell instanceof Map<?, ?> m ? m.get("answer") : cell;

                Map<String, Object> verdict = new LinkedHashMap<>();
                verdict.put("correct", PracticeExerciseGrader.isCorrect(exercise, submitted));
                // Trắc nghiệm: sau khi chọn, tô phương án đúng (giữ UX cũ). Đáp án chữ chờ tới /review.
                if ("choice".equals(PracticeExerciseRedactor.answerMode(exercise))
                        && exercise.get("correct_index") instanceof Number ci) {
                    verdict.put("correctIndex", ci.intValue());
                }
                results.put(String.valueOf(index), verdict);
            }
        }
        return Map.of("results", results);
    }

    /** Đáp án + giải thích đầy đủ, chỉ sau khi đã nộp (status COMPLETED). Chỉ đọc. */
    public Map<String, Object> review(long userId, long sessionId) {
        Map<String, Object> detail = practiceNodeService.getSessionDetail(userId, sessionId);
        if (!"COMPLETED".equals(String.valueOf(detail.get("status")))) {
            throw new ConflictException("Bài luyện chưa nộp — đáp án chỉ hiện sau khi nộp.");
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("sessionId", detail.get("sessionId"));
        out.put("status", detail.get("status"));
        out.put("exercises", PracticeExerciseRedactor.exercisesOf(detail.get("exercises")));
        return out;
    }
}
