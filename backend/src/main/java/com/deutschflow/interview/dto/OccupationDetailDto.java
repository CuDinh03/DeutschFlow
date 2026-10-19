package com.deutschflow.interview.dto;

import java.util.List;

/**
 * Chi tiết một nghề kèm câu hỏi mẫu ({@code GET /api/public/occupations/{code}}).
 *
 * <p>{@code personaCode} + {@code interviewPosition} là đúng cặp mà client gửi khi tạo phiên
 * phỏng vấn ({@code CreateSessionRequest.persona}, {@code interviewPosition}), nên câu hỏi mẫu
 * trùng câu AI hỏi trong phiên. Câu mẫu lấy từ {@code InterviewQuestionBank} (nguyên văn), không
 * gọi AI theo lượt xem.
 */
public record OccupationDetailDto(
        OccupationDto occupation,
        String personaCode,
        String interviewPosition,
        List<SampleQuestion> sampleQuestions
) {
    public record SampleQuestion(String phase, String questionDe) {}
}
