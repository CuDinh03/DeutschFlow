package com.deutschflow.user.dto;

/**
 * Kết quả bước mật khẩu của {@code AuthService.login}: hoặc một phiên đầy đủ ({@link Session} — mọi vai trò
 * ngoài ADMIN, giữ nguyên hợp đồng {@link AuthResponse} cũ), hoặc một thử thách 2FA ({@link MfaChallenge}).
 */
public sealed interface LoginResult permits LoginResult.Session, LoginResult.MfaChallenge {

    record Session(AuthResponse response) implements LoginResult {}

    record MfaChallenge(MfaChallengeResponse challenge) implements LoginResult {}
}
