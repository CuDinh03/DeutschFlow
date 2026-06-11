package com.deutschflow.teacher.dto;

/**
 * Kết quả chấm ảnh bài viết tay: chữ đọc được + điểm + nhận xét.
 *
 * @param transcription văn bản tiếng Đức OCR từ ảnh (giáo viên nên rà lại trước khi chốt điểm)
 * @param score         điểm AI chấm trên văn bản đã OCR (0–100)
 * @param feedback      nhận xét tiếng Việt
 */
public record GradeImageResponse(String transcription, int score, String feedback) {}
