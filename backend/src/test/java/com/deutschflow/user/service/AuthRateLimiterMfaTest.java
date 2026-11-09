package com.deutschflow.user.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Ngân sách LẦN SAI 2FA (mặc định 5 / 15 phút) theo người dùng và theo IP — bộ nhớ (không Redis). */
@DisplayName("AuthRateLimiterService — 2FA")
class AuthRateLimiterMfaTest {

    private static AuthRateLimiterService limiter() {
        return new AuthRateLimiterService(3, 60, 5, 120, 2, 600, 4, 60, 2, 900, null);
    }

    @Test
    @DisplayName("5 lần sai cùng người dùng → bị khoá; lần sai thứ 5 báo 'vừa chạm trần' đúng một lần")
    void perUserBudget() {
        AuthRateLimiterService rl = limiter();
        for (int i = 1; i <= 4; i++) {
            assertThat(rl.isMfaBlocked(1L, "ip-" + i)).isFalse();
            assertThat(rl.recordMfaFailure(1L, "ip-" + i)).isFalse();
        }
        assertThat(rl.recordMfaFailure(1L, "ip-5")).isTrue();
        assertThat(rl.isMfaBlocked(1L, "ip-other")).isTrue();
        assertThat(rl.isMfaBlocked(2L, "ip-other")).isFalse();
        assertThat(rl.mfaRetryAfterSeconds()).isEqualTo(900);
    }

    @Test
    @DisplayName("5 lần sai cùng IP trên nhiều tài khoản → IP bị khoá cho mọi tài khoản")
    void perIpBudget() {
        AuthRateLimiterService rl = limiter();
        for (long u = 1; u <= 5; u++) {
            rl.recordMfaFailure(u, "203.0.113.9");
        }
        assertThat(rl.isMfaBlocked(99L, "203.0.113.9")).isTrue();
        assertThat(rl.isMfaBlocked(99L, "198.51.100.1")).isFalse();
    }

    @Test
    @DisplayName("kiểm 'đang khoá' không tự ghi thêm lượt (chỉ lần SAI mới bị đếm)")
    void checkDoesNotConsume() {
        AuthRateLimiterService rl = limiter();
        for (int i = 0; i < 20; i++) {
            assertThat(rl.isMfaBlocked(1L, "ip")).isFalse();
        }
    }

    @Test
    @DisplayName("gửi mã email 2FA: 5 thư / giờ / người dùng")
    void emailSendBudget() {
        AuthRateLimiterService rl = limiter();
        for (int i = 0; i < 5; i++) {
            assertThat(rl.allowMfaEmailSend(1L)).isTrue();
        }
        assertThat(rl.allowMfaEmailSend(1L)).isFalse();
        assertThat(rl.allowMfaEmailSend(2L)).isTrue();
    }
}
