package com.deutschflow.common.security;

/**
 * Tên request attribute mà {@link JwtAuthFilter} đặt sau khi chấp nhận một JWT, để các filter/handler
 * phía sau đọc loại token và claim tùy biến mà KHÔNG phải parse/verify lại token.
 *
 * <p>Chỉ có mặt khi request được xác thực bằng JWT (Bearer). Request xác thực bằng SSE ticket hoặc
 * credential khác (Prometheus scrape token) không có các attribute này.
 */
public final class AuthTokenAttributes {

    /** {@link io.jsonwebtoken.Claims} đã verify của token. */
    public static final String CLAIMS = AuthTokenAttributes.class.getName() + ".CLAIMS";

    /**
     * Loại token đã chuẩn hóa ({@link JwtService#TYP_ACCESS}, {@link JwtService#TYP_GUEST},
     * {@link JwtService#TYP_SUPPORT}) — thiếu claim {@code typ} được ghi là {@code access}.
     */
    public static final String TOKEN_TYPE = AuthTokenAttributes.class.getName() + ".TOKEN_TYPE";

    private AuthTokenAttributes() {
    }
}
