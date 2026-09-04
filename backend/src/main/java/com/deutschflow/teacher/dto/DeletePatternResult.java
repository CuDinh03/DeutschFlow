package com.deutschflow.teacher.dto;

/**
 * Kết quả xoá lịch cố định (PR-5 — trước đây endpoint trả số nguyên trần): {@code removedSessions}
 * = số buổi tương lai chưa override bị gỡ; {@code pendingRequestId} khác null = lớp trung tâm có
 * giáo trình, việc xoá vào hàng chờ duyệt và CHƯA có gì bị gỡ.
 */
public record DeletePatternResult(int removedSessions, Long pendingRequestId) {}
