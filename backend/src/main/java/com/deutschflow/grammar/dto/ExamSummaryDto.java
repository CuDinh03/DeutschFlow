package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * One row of the mock-exam list — response element of {@code GET /api/mock-exams?cefrLevel=}.
 * <p>
 * JSON keys are kept snake_case (raw {@code mock_exams} columns) to match the existing web/mobile
 * contract; {@code @JsonProperty} maps them onto idiomatic camelCase record components.
 */
public record ExamSummaryDto(
        long id,
        @JsonProperty("cefr_level") String cefrLevel,
        @JsonProperty("exam_format") String examFormat,
        String title,
        @JsonProperty("description_vi") String descriptionVi,
        @JsonProperty("total_points") Integer totalPoints,
        @JsonProperty("pass_points") Integer passPoints,
        @JsonProperty("time_limit_minutes") Integer timeLimitMinutes,
        // V342: đề nháp chờ duyệt — chỉ có mặt khi client xin includeComingSoon=true
        @JsonProperty("coming_soon") boolean comingSoon,
        // V379: đề phát hành trong NEW_BADGE_DAYS ngày gần đây — client gắn nhãn "Mới"
        @JsonProperty("is_new") boolean isNew) {

    /** Số ngày kể từ lúc phát hành mà đề còn được coi là mới. */
    public static final int NEW_BADGE_DAYS = 14;

    /** Biểu thức SQL trên bảng mock_exams: đề đã phát hành và còn trong hạn "Mới". */
    public static final String IS_NEW_SQL =
            "(reviewed = TRUE AND published_at > now() - make_interval(days => " + NEW_BADGE_DAYS + "))";
}
