package com.deutschflow.practice.dto;

import java.util.List;

/**
 * A3: đề bài tập bổ trợ KHÔNG kèm đáp án ({@code correctAnswer}/{@code explanation} chỉ trả về sau
 * khi nộp, qua {@link PracticeGradeResponse}). {@code gradable} cho client biết câu nào được chấm
 * (câu không có đáp án trong DB bị loại khỏi mẫu số) mà không cần nhìn đáp án.
 */
public record PracticeQuizDto(
        Long id,
        String exerciseType,
        String cefrLevel,
        String skillType,
        String examName,
        String sourceName,
        String sourceUrl,
        Integer xpReward,
        String title,
        String instructions,
        String readingText,
        List<Question> questions,
        int gradableCount
) {
    public record Question(String id, String type, String question, List<String> options, boolean gradable) {
    }
}
