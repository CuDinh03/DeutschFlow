package com.deutschflow.practice.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import java.util.Map;

/**
 * A3: nộp bài tập bổ trợ để server chấm. {@code answers}: id câu → đáp án học viên chọn/gõ.
 * {@code scorePercent} chỉ dùng cho bài "tài nguyên ngoài" không có đáp án (tự xác nhận hoàn
 * thành); bài có đáp án thì server bỏ qua và tự chấm.
 */
public record PracticeGradeRequest(
        Map<String, String> answers,
        @Min(0) @Max(100) Integer scorePercent
) {
}
