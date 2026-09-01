package com.deutschflow.teacher.dto;

/**
 * Kết quả đặt/đổi lịch cố định: id pattern, số buổi mới sinh ra, số buổi đã chỉnh tay được GIỮ
 * NGUYÊN (override sticky), và số buổi BỊ BỎ QUA vì trùng lịch dạy của chính giáo viên ở lớp khác
 * — để FE báo "X buổi đã chỉnh tay được giữ nguyên · bỏ qua Y buổi trùng lịch".
 *
 * <p>PR-5: {@code pendingRequestId} khác null = lớp trung tâm có giáo trình — đề xuất vào hàng chờ
 * duyệt, pattern CHƯA đổi (patternId/generated khi đó là 0/null-vô-nghĩa, FE đọc pendingRequestId).
 */
public record UpsertPatternResult(
        Long patternId,
        int generated,
        int keptOverridden,
        int skipped,
        Long pendingRequestId
) {
    /** Arity cũ (trước PR-5) — đường ghi trực tiếp của lớp thường. */
    public UpsertPatternResult(Long patternId, int generated, int keptOverridden, int skipped) {
        this(patternId, generated, keptOverridden, skipped, null);
    }
}
