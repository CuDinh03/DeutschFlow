package com.deutschflow.practice.dto;

/**
 * Kết quả {@code POST /api/practice/submit} (A2, 09/11/2026). Trước đây endpoint trả 200 không thân;
 * thân này là thêm mới nên client cũ bỏ qua vẫn chạy như cũ.
 *
 * @param scorePercent điểm server chấm (0 với bài external hoặc khi không chấm được)
 * @param xpEarned     XP thực sự được cộng cho lần nộp này
 * @param graded       server đã chấm theo đáp án lưu trong DB
 * @param external     bài "external" (chỉ có {@code source_url}) — XP cố định, 1 lần/bài/ngày
 */
public record PracticeSubmitResponse(
        int scorePercent,
        int xpEarned,
        boolean graded,
        boolean external
) {}
