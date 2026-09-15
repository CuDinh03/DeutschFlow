package com.deutschflow.organization.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Body for {@code POST /api/admin/organizations/{id}/force-owner} — đường khôi phục quyền giám đốc
 * của admin nền tảng (DEC-13 / A6, owner chốt 10/09/2026).
 *
 * <p>{@code reason} là BẮT BUỘC và phải đủ dài để đọc được sáu tháng sau trong sổ trung tâm: đây
 * là thao tác thay chủ một tenant mà không cần chủ cũ đồng ý, nên lý do đi vào vết audit nguyên văn.
 */
public record ForceOwnerRequest(
        @NotNull(message = "Phải chọn người được chỉ định làm giám đốc.")
        Long newOwnerUserId,
        @NotBlank(message = "Lý do là bắt buộc.")
        @Size(min = 10, max = 500, message = "Lý do phải từ 10 đến 500 ký tự.")
        String reason) {
}
