package com.deutschflow.user.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.data.redis.core.script.RedisScript;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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

    // ─── thời gian còn lại + gỡ khoá theo người dùng (25/11/2026) ──────────────────

    @Test
    @DisplayName("bị khoá ngay sau 5 lần sai → còn ~15 phút; không bao giờ vượt trần cửa sổ, tối thiểu 1 giây")
    void retryAfterRemainingInMemory() {
        AuthRateLimiterService rl = limiter();
        for (int i = 0; i < 5; i++) {
            failOnce(rl, 1L, "ip");
        }
        int wait = rl.mfaRetryAfterSeconds(1L, "ip");
        assertThat(wait).isEqualTo(900); // ~899,9 s làm tròn lên phút, kẹp ở trần cửa sổ
        assertThat(rl.mfaRetryAfterSeconds(2L, "ip-khac")).isEqualTo(1);
    }

    @Test
    @DisplayName("Redis: thời gian còn lại = lượt phải rời cửa sổ, lấy max của người dùng và IP; trên 1 phút làm tròn lên phút")
    @SuppressWarnings("unchecked")
    void retryAfterRemainingRedis() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        when(redis.execute(any(RedisScript.class), eq(List.of("rl:mfa-fail-user|1")), any(), any(), any()))
                .thenReturn(312_400L);
        when(redis.execute(any(RedisScript.class), eq(List.of("rl:mfa-fail-ip|203.0.113.9")), any(), any(), any()))
                .thenReturn(40_000L);
        AuthRateLimiterService rl = new AuthRateLimiterService(3, 60, 5, 120, 2, 600, 4, 60, 2, 900, redis);

        assertThat(rl.mfaRetryAfterSeconds(1L, "203.0.113.9")).isEqualTo(360);
        // Dưới một phút: tính bằng giây (làm tròn lên).
        when(redis.execute(any(RedisScript.class), eq(List.of("rl:mfa-fail-user|2")), any(), any(), any()))
                .thenReturn(40_100L);
        when(redis.execute(any(RedisScript.class), eq(List.of("rl:mfa-fail-ip|198.51.100.1")), any(), any(), any()))
                .thenReturn(0L);
        assertThat(rl.mfaRetryAfterSeconds(2L, "198.51.100.1")).isEqualTo(41);
    }

    @Test
    @DisplayName("IP đã gây lần sai của một người (để ghi vết gỡ khoá): khác nhau, đúng người")
    void failureIpsForUser() {
        AuthRateLimiterService rl = limiter();
        failOnce(rl, 1L, "203.0.113.9");
        failOnce(rl, 1L, "203.0.113.9");
        failOnce(rl, 1L, "198.51.100.1");
        failOnce(rl, 2L, "192.0.2.5");

        assertThat(rl.mfaFailureIpsInWindow(1L)).containsExactly("203.0.113.9", "198.51.100.1");
        assertThat(rl.mfaFailureIpsInWindow(3L)).isEmpty();
    }

    @Test
    @DisplayName("gỡ khoá một người: xoá lần sai của người đó ở ngân sách người dùng VÀ IP; lần sai của người khác cùng IP vẫn tính")
    void clearFailuresForUserInMemory() {
        AuthRateLimiterService rl = limiter();
        for (int i = 0; i < 3; i++) {
            failOnce(rl, 1L, "203.0.113.9");
        }
        failOnce(rl, 2L, "203.0.113.9");
        failOnce(rl, 2L, "203.0.113.9");
        failOnce(rl, 1L, "198.51.100.1");
        failOnce(rl, 1L, "198.51.100.1");
        assertThat(rl.isMfaBlocked(1L, "x")).isTrue();
        assertThat(rl.isMfaBlocked(99L, "203.0.113.9")).isTrue();
        assertThat(rl.mfaFailuresInWindow(1L)).isEqualTo(5);

        assertThat(rl.clearMfaFailuresForUser(1L)).isEqualTo(5);

        assertThat(rl.mfaFailuresInWindow(1L)).isZero();
        assertThat(rl.isMfaBlocked(1L, "x")).isFalse();
        assertThat(rl.isMfaBlocked(99L, "203.0.113.9")).isFalse();
        assertThat(rl.mfaFailuresInWindow(2L)).isEqualTo(2);
        // IP 203.0.113.9 còn đúng 2 lần sai của người 2: thêm 3 lần nữa là đầy lại.
        for (long u = 10; u < 13; u++) {
            failOnce(rl, u, "203.0.113.9");
        }
        assertThat(rl.isMfaBlocked(99L, "203.0.113.9")).isTrue();
    }

    @Test
    @DisplayName("gỡ khoá khi không có lần sai nào → 0, không lỗi")
    void clearFailuresNothing() {
        assertThat(limiter().clearMfaFailuresForUser(42L)).isZero();
    }

    @Test
    @DisplayName("Redis: member gắn nhãn IP/người dùng; gỡ khoá chỉ xoá member của đúng người ở khoá IP")
    @SuppressWarnings("unchecked")
    void clearFailuresForUserRedis() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ZSetOperations<String, String> zset = mock(ZSetOperations.class);
        when(redis.opsForZSet()).thenReturn(zset);
        when(redis.execute(any(RedisScript.class), any(List.class), any(), any(), any(), any())).thenReturn(1L);
        AuthRateLimiterService rl = new AuthRateLimiterService(3, 60, 5, 120, 2, 600, 4, 60, 2, 900, redis);

        rl.tryAcquireMfaAttempt(1L, "203.0.113.9").orElseThrow();
        ArgumentCaptor<Object> args = ArgumentCaptor.forClass(Object.class);
        verify(redis, org.mockito.Mockito.times(2)).execute(any(RedisScript.class), any(List.class),
                args.capture(), args.capture(), args.capture(), args.capture());
        List<Object> all = args.getAllValues();
        assertThat((String) all.get(3)).endsWith("|203.0.113.9");
        assertThat((String) all.get(7)).endsWith("|u1");

        when(zset.range("rl:mfa-fail-user|1", 0, -1))
                .thenReturn(new LinkedHashSet<>(List.of("1-1|203.0.113.9", "2-2|203.0.113.9", "3-3|198.51.100.1")));
        when(zset.range("rl:mfa-fail-ip|203.0.113.9", 0, -1))
                .thenReturn(new LinkedHashSet<>(List.of("1-1|u1", "2-2|u1", "9-9|u2")));
        when(zset.range("rl:mfa-fail-ip|198.51.100.1", 0, -1))
                .thenReturn(new LinkedHashSet<>(List.of("3-3|u1")));

        assertThat(rl.clearMfaFailuresForUser(1L)).isEqualTo(3);

        verify(redis).delete("rl:mfa-fail-user|1");
        verify(zset).remove("rl:mfa-fail-ip|203.0.113.9", "1-1|u1", "2-2|u1");
        verify(zset).remove("rl:mfa-fail-ip|198.51.100.1", "3-3|u1");
        verify(zset, never()).remove(eq("rl:mfa-fail-ip|203.0.113.9"), eq("9-9|u2"));
    }
}
