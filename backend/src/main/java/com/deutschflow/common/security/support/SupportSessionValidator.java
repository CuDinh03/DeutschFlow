package com.deutschflow.common.security.support;

import io.jsonwebtoken.Claims;

import java.util.Optional;

/**
 * Xác minh một token {@code typ=support} đã qua chữ ký với trạng thái trong DB (phiên còn mở, admin còn là ADMIN
 * hoạt động, người dùng đích khớp và hợp lệ). Fail-closed: mọi sai lệch, kể cả lỗi DB → {@link Optional#empty()}
 * và {@code JwtAuthFilter} trả 401.
 */
@FunctionalInterface
public interface SupportSessionValidator {

    Optional<SupportSessionContext> validate(Claims claims);

    /** Mặc định khi không có bean xác minh (test dựng tay): từ chối mọi token support. */
    SupportSessionValidator REJECT_ALL = claims -> Optional.empty();
}
