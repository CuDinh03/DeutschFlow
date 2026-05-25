package com.deutschflow.user.dto;

/**
 * Body của POST /api/auth/refresh.
 *
 * <p>Sau khi chuyển sang HttpOnly cookie, refreshToken đến từ cookie {@code refresh_token}.
 * Field này được giữ lại để tương thích ngược với client cũ (gửi trong body).
 * Cookie sẽ được ưu tiên; body chỉ là fallback trong giai đoạn chuyển tiếp.
 *
 * <p><b>Không thêm {@code @NotBlank}</b> vì field này có thể null khi client dùng cookie.
 */
public record RefreshRequest(
        String refreshToken
) {}
