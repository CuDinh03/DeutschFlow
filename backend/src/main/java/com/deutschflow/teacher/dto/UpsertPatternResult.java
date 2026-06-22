package com.deutschflow.teacher.dto;

/**
 * Kết quả đặt/đổi lịch cố định: id pattern, số buổi mới sinh ra, và số buổi đã chỉnh tay
 * được GIỮ NGUYÊN (override sticky) để FE báo "X buổi đã chỉnh tay được giữ nguyên".
 */
public record UpsertPatternResult(
        Long patternId,
        int generated,
        int keptOverridden
) {}
