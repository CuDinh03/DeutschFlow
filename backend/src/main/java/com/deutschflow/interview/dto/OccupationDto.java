package com.deutschflow.interview.dto;

import java.util.List;

/**
 * Một nghề trong danh mục công khai ({@code GET /api/public/occupations}).
 *
 * @param questionSet {@code CURATED} khi nghề có bộ câu hỏi viết tay của nhân vật;
 *                    {@code GENERAL} khi AI dùng bộ câu hỏi chung kèm tên nghề. Đợt 2b thêm mức
 *                    cho câu hỏi theo nghề do AI tạo và đã duyệt.
 */
public record OccupationDto(
        String code,
        String nameDe,
        String nameEn,
        String nameVi,
        String workplace,
        List<String> aliases,
        String questionSet
) {
    public static final String CURATED = "CURATED";
    public static final String GENERAL = "GENERAL";
}
