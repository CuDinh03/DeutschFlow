package com.deutschflow.teacher.dto;

/**
 * Kết quả đặt/đổi lịch cố định: id pattern, số buổi mới sinh ra, số buổi đã chỉnh tay được GIỮ
 * NGUYÊN (override sticky), và số buổi BỊ BỎ QUA vì trùng lịch dạy của chính giáo viên ở lớp khác
 * — để FE báo "X buổi đã chỉnh tay được giữ nguyên · bỏ qua Y buổi trùng lịch".
 */
public record UpsertPatternResult(
        Long patternId,
        int generated,
        int keptOverridden,
        int skipped
) {}
