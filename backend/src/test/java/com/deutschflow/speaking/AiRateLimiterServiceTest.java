package com.deutschflow.speaking;

import com.deutschflow.speaking.AiRateLimiterService.Bucket;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * In-memory fallback exercise (Redis is null → degrades to the per-node sliding window).
 * The Redis Lua path is covered indirectly by parity with {@link com.deutschflow.user.service.AuthRateLimiterService}.
 */
class AiRateLimiterServiceTest {

    /** Build a limiter with uniform max/window across every bucket; tests exercise the TRANSCRIBE bucket. */
    private static AiRateLimiterService limiter(int max, long window) {
        return new AiRateLimiterService(
                max, window, max, window, max, window,
                max, window, max, window, max, window, null);
    }

    @Test
    @DisplayName("first request from a user passes")
    void firstRequestAllowed() {
        var limiter = limiter(3, 60);
        assertThat(limiter.allow(Bucket.TRANSCRIBE, 1L)).isTrue();
    }

    @Test
    @DisplayName("limit is enforced per user")
    void limitEnforcedPerUser() {
        var limiter = limiter(3, 60);

        assertThat(limiter.allow(Bucket.TRANSCRIBE, 1L)).isTrue();
        assertThat(limiter.allow(Bucket.TRANSCRIBE, 1L)).isTrue();
        assertThat(limiter.allow(Bucket.TRANSCRIBE, 1L)).isTrue();
        // 4th hit within the window is refused
        assertThat(limiter.allow(Bucket.TRANSCRIBE, 1L)).isFalse();
    }

    @Test
    @DisplayName("two users have independent budgets — one user's limit doesn't block another")
    void perUserIsolation() {
        var limiter = limiter(2, 60);

        assertThat(limiter.allow(Bucket.TRANSCRIBE, 1L)).isTrue();
        assertThat(limiter.allow(Bucket.TRANSCRIBE, 1L)).isTrue();
        assertThat(limiter.allow(Bucket.TRANSCRIBE, 1L)).isFalse(); // user 1 exhausted

        assertThat(limiter.allow(Bucket.TRANSCRIBE, 2L)).isTrue();  // user 2 still has budget
        assertThat(limiter.allow(Bucket.TRANSCRIBE, 2L)).isTrue();
        assertThat(limiter.allow(Bucket.TRANSCRIBE, 2L)).isFalse();
    }

    @ParameterizedTest
    @ValueSource(ints = { -5, 0, 1 })
    @DisplayName("max is clamped to a positive value (config defenses)")
    void maxClampedToPositive(int configuredMax) {
        var limiter = limiter(configuredMax, 60);

        assertThat(limiter.allow(Bucket.TRANSCRIBE, 1L)).isTrue();
        // Internally clamped to max(1, configured); after the first hit any subsequent within-
        // window call is refused.
        assertThat(limiter.allow(Bucket.TRANSCRIBE, 1L)).isFalse();
    }

    @Test
    @DisplayName("retryAfter (legacy, deprecated) exposes the configured window for the client")
    void retryAfterExposed() {
        var limiter = limiter(60, 3600);
        assertThat(limiter.retryAfterSeconds(Bucket.TRANSCRIBE)).isEqualTo(3600);
    }

    @Test
    @DisplayName("per-user retryAfter phản ánh thời điểm slot mở, KHÔNG trả cả window (R-B6)")
    void retryAfterPerUserReflectsOldestHit() {
        // window 3600s, max 1: sau hit đầu, slot chỉ mở lại khi hit cũ nhất rời cửa sổ ⇒ ~3600s,
        // nhưng KHÔNG được vượt window và phải > 0. Quan trọng: với user CHƯA hit thì trả 1 (không 3600).
        var limiter = limiter(1, 3600);

        // Chưa có hit nào cho user 2 → không khoá oan 1 giờ.
        assertThat(limiter.retryAfterSeconds(Bucket.TRANSCRIBE, 2L)).isEqualTo(1);

        assertThat(limiter.allow(Bucket.TRANSCRIBE, 1L)).isTrue();
        int retry = limiter.retryAfterSeconds(Bucket.TRANSCRIBE, 1L);
        // Vừa hit xong nên còn gần trọn cửa sổ, nhưng phải nằm trong (0, window].
        assertThat(retry).isGreaterThan(0).isLessThanOrEqualTo(3600);
    }

    @Test
    @DisplayName("per-user retryAfter ngắn khi window nhỏ")
    void retryAfterShortWindow() {
        var limiter = limiter(1, 5);
        assertThat(limiter.allow(Bucket.CHAT, 7L)).isTrue();
        // Cửa sổ 5s: retry phải ≤ 5s (trước đây trả nguyên window bất kể — vẫn ≤ window, nhưng đây
        // chốt rằng giá trị bám theo window nhỏ chứ không phải một hằng 3600 nào đó).
        assertThat(limiter.retryAfterSeconds(Bucket.CHAT, 7L)).isBetween(1, 5);
    }

    @Test
    @DisplayName("buckets are independent — exhausting one does not block another")
    void bucketsAreIndependent() {
        var limiter = limiter(1, 60);

        assertThat(limiter.allow(Bucket.TRANSCRIBE, 1L)).isTrue();
        assertThat(limiter.allow(Bucket.TRANSCRIBE, 1L)).isFalse(); // transcribe exhausted
        assertThat(limiter.allow(Bucket.CHAT, 1L)).isTrue();        // chat bucket still has budget
    }
}
