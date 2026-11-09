package com.deutschflow.user.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Ngân sách 2FA (mặc định 5 lượt / 15 phút) theo người dùng và theo IP — bộ nhớ (không Redis). Mỗi lượt GIỮ CHỖ
 * nguyên tử trước khi kiểm mã; mã sai giữ chỗ thành lần sai, mã đúng trả chỗ.
 */
@DisplayName("AuthRateLimiterService — 2FA")
class AuthRateLimiterMfaTest {

    private static AuthRateLimiterService limiter() {
        return new AuthRateLimiterService(3, 60, 5, 120, 2, 600, 4, 60, 2, 900, null);
    }

    /** Một lần sai trọn vẹn: giữ chỗ rồi ghi là sai. */
    private static boolean failOnce(AuthRateLimiterService rl, long userId, String ip) {
        AuthRateLimiterService.MfaAttempt a = rl.tryAcquireMfaAttempt(userId, ip).orElseThrow();
        return rl.commitMfaFailure(a);
    }

    @Test
    @DisplayName("5 lần sai cùng người dùng → bị khoá; lần sai thứ 5 báo 'vừa chạm trần' đúng một lần")
    void perUserBudget() {
        AuthRateLimiterService rl = limiter();
        for (int i = 1; i <= 4; i++) {
            assertThat(rl.isMfaBlocked(1L, "ip-" + i)).isFalse();
            assertThat(failOnce(rl, 1L, "ip-" + i)).isFalse();
        }
        assertThat(failOnce(rl, 1L, "ip-5")).isTrue();
        assertThat(rl.isMfaBlocked(1L, "ip-other")).isTrue();
        assertThat(rl.tryAcquireMfaAttempt(1L, "ip-other")).isEmpty();
        assertThat(rl.isMfaBlocked(2L, "ip-other")).isFalse();
        assertThat(rl.mfaRetryAfterSeconds()).isEqualTo(900);
    }

    @Test
    @DisplayName("5 lần sai cùng IP trên nhiều tài khoản → IP bị khoá cho mọi tài khoản")
    void perIpBudget() {
        AuthRateLimiterService rl = limiter();
        for (long u = 1; u <= 5; u++) {
            failOnce(rl, u, "203.0.113.9");
        }
        assertThat(rl.isMfaBlocked(99L, "203.0.113.9")).isTrue();
        assertThat(rl.tryAcquireMfaAttempt(99L, "203.0.113.9")).isEmpty();
        assertThat(rl.isMfaBlocked(99L, "198.51.100.1")).isFalse();
    }

    @Test
    @DisplayName("IP đầy thì chỗ đã giữ ở ngân sách người dùng được trả lại (không bị tính oan)")
    void ipFullReleasesUserSlot() {
        AuthRateLimiterService rl = limiter();
        for (long u = 10; u < 15; u++) {
            failOnce(rl, u, "203.0.113.9");
        }
        for (int i = 0; i < 10; i++) {
            assertThat(rl.tryAcquireMfaAttempt(1L, "203.0.113.9")).isEmpty();
        }
        assertThat(rl.isMfaBlocked(1L, "198.51.100.1")).isFalse();
        for (int i = 0; i < 4; i++) {
            failOnce(rl, 1L, "198.51.100." + i);
        }
        assertThat(rl.isMfaBlocked(1L, "198.51.100.200")).isFalse();
    }

    @Test
    @DisplayName("lượt đúng được trả chỗ: giữ-rồi-trả 20 lần không làm đầy ngân sách")
    void refundedAttemptsDoNotCount() {
        AuthRateLimiterService rl = limiter();
        for (int i = 0; i < 20; i++) {
            AuthRateLimiterService.MfaAttempt a = rl.tryAcquireMfaAttempt(1L, "ip").orElseThrow();
            rl.refundMfaAttempt(a);
        }
        assertThat(rl.isMfaBlocked(1L, "ip")).isFalse();
    }

    @Test
    @DisplayName("kết thúc lượt chỉ một lần: trả chỗ sau khi đã ghi sai là no-op (vẫn tính lần sai)")
    void settleOnce() {
        AuthRateLimiterService rl = limiter();
        for (int i = 0; i < 5; i++) {
            AuthRateLimiterService.MfaAttempt a = rl.tryAcquireMfaAttempt(1L, "ip").orElseThrow();
            rl.commitMfaFailure(a);
            rl.refundMfaAttempt(a);
            assertThat(rl.commitMfaFailure(a)).isFalse();
        }
        assertThat(rl.isMfaBlocked(1L, "ip")).isTrue();
    }

    @Test
    @DisplayName("kiểm 'đang khoá' không tự ghi thêm lượt")
    void checkDoesNotConsume() {
        AuthRateLimiterService rl = limiter();
        for (int i = 0; i < 20; i++) {
            assertThat(rl.isMfaBlocked(1L, "ip")).isFalse();
        }
    }

    @Test
    @DisplayName("20 luồng giữ chỗ cùng lúc (cùng người dùng, khác IP) → đúng 5 luồng được, 15 luồng bị từ chối")
    void concurrentAcquireNeverExceedsLimit() throws Exception {
        AuthRateLimiterService rl = limiter();
        int threads = 20;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch go = new CountDownLatch(1);
        List<Future<Optional<AuthRateLimiterService.MfaAttempt>>> futures = new ArrayList<>();
        try {
            for (int i = 0; i < threads; i++) {
                String ip = "198.51.100." + i;
                futures.add(pool.submit(() -> {
                    go.await();
                    return rl.tryAcquireMfaAttempt(1L, ip);
                }));
            }
            go.countDown();
            int acquired = 0;
            for (Future<Optional<AuthRateLimiterService.MfaAttempt>> f : futures) {
                if (f.get(10, TimeUnit.SECONDS).isPresent()) {
                    acquired++;
                }
            }
            assertThat(acquired).isEqualTo(5);
        } finally {
            pool.shutdownNow();
        }
        assertThat(rl.tryAcquireMfaAttempt(1L, "203.0.113.1")).isEmpty();
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
