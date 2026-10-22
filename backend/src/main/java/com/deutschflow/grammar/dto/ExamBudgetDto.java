package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * "Ngân sách điểm" của một bài thi thử nhiều cổng (LT1, 22/10/2026) — trả kèm
 * {@code GET /api/mock-exams/attempts/{id}/result} cho đề có {@code pass_rule} (telc). Đề Goethe
 * không có khối này.
 *
 * <p>Tính lại lúc đọc từ đáp án đã nộp + {@code sections_json} (không lưu): bài làm cũ cũng có, và
 * một phiên thi Nói làm sau vẫn cập nhật được dòng Nói.
 *
 * @param totalMax    tổng điểm tối đa của kỳ thi, gồm cả phần thi ngoài đề giấy (telc B1: 300)
 * @param earned      điểm đã đạt trên các phần đã chấm xong
 * @param lost        điểm đã mất trên các phần đã chấm xong
 * @param pending     còn phần chưa chấm (bài viết chờ AI, chưa thi Nói) ⇒ {@code earned}/{@code lost} chưa trọn
 * @param losses      điểm đã mất theo Teil, Teil mất nhiều nhất đứng đầu; phần chưa chấm ở cuối
 * @param targets     mục tiêu xếp loại (cao → thấp); rỗng khi chưa có bảng xếp loại cho đề này
 */
public record ExamBudgetDto(
        double totalMax,
        double earned,
        double lost,
        boolean pending,
        List<TeilLoss> losses,
        List<GradeTarget> targets
) {
    /**
     * Một dòng điểm đã mất.
     *
     * @param section      {@code LESEN} / {@code SPRACHBAUSTEINE} / {@code HOEREN} / {@code SCHREIBEN} / {@code SPRECHEN}
     * @param teil         số Teil; {@code null} khi cả phần là một dòng (Viết, Nói)
     * @param pointPerItem điểm mỗi câu của Teil (telc: 5 / 2,5 / 1,5); {@code null} khi không đều hoặc không phải câu
     * @param items        số câu của Teil; {@code null} với dòng không tính theo câu
     * @param correct      số câu đúng; {@code null} như trên
     * @param earned       {@code null} khi {@code pending}
     * @param lost         {@code null} khi {@code pending}
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record TeilLoss(String section, Integer teil, double max, Double earned, Double lost,
                           Double pointPerItem, Integer items, Integer correct, boolean pending) {}

    /**
     * @param grade      {@code SEHR_GUT} / {@code GUT} / {@code BEFRIEDIGEND} / {@code AUSREICHEND}
     * @param minPoints  điểm tối thiểu của xếp loại trên thang {@link #totalMax}
     * @param maxLoss    được mất tối đa bao nhiêu điểm mà vẫn đạt xếp loại này
     * @param remaining  còn được mất thêm bao nhiêu ({@code maxLoss − lost}); âm = đã vượt ngân sách
     * @param example    một cách chia {@code maxLoss} theo phần, tỉ lệ với điểm tối đa của phần
     */
    public record GradeTarget(String grade, double minPoints, double maxLoss, double remaining,
                              List<SectionShare> example) {}

    /** @param maxLoss phần ngân sách mất điểm chia cho phần này (bội số 0,5) */
    public record SectionShare(String section, double max, double maxLoss) {}
}
