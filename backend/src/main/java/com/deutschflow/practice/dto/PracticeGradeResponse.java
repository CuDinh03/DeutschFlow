package com.deutschflow.practice.dto;

import java.util.List;

/**
 * A3: kết quả chấm SAU khi nộp — lúc này mới có {@code correctAnswer} và {@code explanation}.
 * {@code graded=false}: bài tài nguyên ngoài (không có đáp án), điểm là phần tự xác nhận.
 *
 * <p>{@code scorePercent}/{@code xpEarned} đọc lại từ dòng {@code practice_history} vừa ghi — tức điểm
 * và XP server THẬT SỰ trao (kể cả luật riêng của PracticeService cho bài ngoài). {@code xpEarned = null}
 * khi không thấy dòng mới: client tự ước lượng như trước.
 */
public record PracticeGradeResponse(
        boolean graded,
        int correctCount,
        int total,
        int scorePercent,
        Integer xpEarned,
        List<QuestionResult> questions
) {
    /** {@code correct} = null với câu không chấm được (không có đáp án trong DB). */
    public record QuestionResult(String id, Boolean correct, String correctAnswer, String explanation) {
    }
}
