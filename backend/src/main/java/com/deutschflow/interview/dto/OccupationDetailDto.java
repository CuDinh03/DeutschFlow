package com.deutschflow.interview.dto;

import java.util.List;

/**
 * Chi tiết một nghề kèm câu hỏi mẫu ({@code GET /api/public/occupations/{code}}).
 *
 * <p>{@code personaCode} + {@code interviewPosition} là đúng cặp mà client gửi khi tạo phiên
 * phỏng vấn ({@code CreateSessionRequest.persona}, {@code interviewPosition}), nên câu hỏi mẫu
 * trùng câu AI hỏi trong phiên. Câu mẫu lấy nguyên văn từ {@code InterviewQuestionBank} hoặc lớp
 * nghề đã lưu (đợt 2d), không gọi AI theo lượt xem.
 *
 * @param reviewed            nghề có bộ viết tay, hoặc lớp nghề có ít nhất 3 câu đã duyệt — trang
 *                            {@code /phong-van/[nghe]} chỉ cho lập chỉ mục khi {@code true}
 * @param occupationQuestions lớp nghề (đợt 2b), bỏ câu REJECTED, câu đã duyệt trước
 * @param terms               từ chuyên môn của nghề, bỏ từ REJECTED, từ đã duyệt trước
 */
public record OccupationDetailDto(
        OccupationDto occupation,
        String personaCode,
        String interviewPosition,
        List<SampleQuestion> sampleQuestions,
        boolean reviewed,
        List<LayerQuestion> occupationQuestions,
        List<Term> terms
) {
    /** Câu thuộc bộ câu hỏi của nhân vật (viết tay hoặc bộ chung). */
    public static final String SOURCE_BANK = "BANK";

    /** @param source {@link #SOURCE_BANK}, {@code APPROVED} hoặc {@code AI_GENERATED} */
    public record SampleQuestion(String phase, String questionDe, String source) {}

    /** @param status {@code APPROVED} hoặc {@code AI_GENERATED} */
    public record LayerQuestion(String questionDe, String difficulty, String status) {}

    /** @param status {@code APPROVED} hoặc {@code AI_GENERATED} */
    public record Term(String termDe, String meaningEn, String meaningVi, String exampleDe, String status) {}
}
