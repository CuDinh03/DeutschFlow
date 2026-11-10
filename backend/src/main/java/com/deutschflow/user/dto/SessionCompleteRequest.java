package com.deutschflow.user.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * Thân {@code POST /api/plan/sessions/complete}.
 *
 * <p>A2 (09/11/2026): {@code abilityScore} được GIỮ trong DTO chỉ để client cũ gửi kèm không bị 400 —
 * server bỏ qua giá trị này. {@code timeSeconds} không còn bị từ chối khi ngoài khoảng: server chặn
 * về [0, thời lượng buổi × 3].
 */
public record SessionCompleteRequest(
        @NotNull(message = "week is required")
        @Min(value = 1, message = "week must be >= 1")
        Integer week,

        @NotNull(message = "sessionIndex is required")
        @Min(value = 1, message = "sessionIndex must be >= 1")
        Integer sessionIndex,

        /** Bỏ qua (server tính lại từ lần nộp). */
        Double abilityScore,

        /** Chặn server-side về [0, thời lượng buổi × 3]. */
        Double timeSeconds
) {}

