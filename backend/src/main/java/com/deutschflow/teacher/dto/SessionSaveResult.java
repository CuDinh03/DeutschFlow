package com.deutschflow.teacher.dto;

import java.util.List;

/**
 * Kết quả lưu một buổi: buổi sau khi lưu + cảnh báo trùng phòng (mềm, không chặn).
 *
 * <p>PR-5: {@code pendingRequestId} khác null = lớp trung tâm có giáo trình — thay đổi KHÔNG được
 * áp thẳng mà đã vào hàng chờ duyệt (AC18); {@code session} khi đó là buổi HIỆN TẠI (chưa đổi).
 */
public record SessionSaveResult(
        ClassSessionDto session,
        List<String> roomWarnings,
        Long pendingRequestId
) {
    /** Arity cũ (trước PR-5) — đường ghi trực tiếp của lớp thường. */
    public SessionSaveResult(ClassSessionDto session, List<String> roomWarnings) {
        this(session, roomWarnings, null);
    }
}
