package com.deutschflow.interview.dto;

import com.deutschflow.interview.entity.OccupationContentStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Quyết định của người duyệt cho một câu hỏi hoặc một từ chuyên môn (đợt 2b). Trường nội dung để
 * trống = giữ nguyên; có giá trị = người duyệt sửa lời rồi duyệt luôn. Trường không thuộc loại nội
 * dung (vd {@code termDe} khi duyệt câu hỏi) bị bỏ qua.
 */
public record OccupationContentReviewRequest(
        @NotNull OccupationContentStatus status,
        @Size(max = 400) String questionDe,
        @Size(max = 120) String termDe,
        @Size(max = 200) String meaningEn,
        @Size(max = 200) String meaningVi,
        @Size(max = 300) String exampleDe,
        @Size(max = 500) String note
) {}
