package com.deutschflow.speaking;

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

    @Test
    @DisplayName("first request from a user passes")
    void firstRequestAllowed() {
        var limiter = new AiRateLimiterService(3, 60, null);
        assertThat(limiter.allowTranscribe(1L)).isTrue();
    }

    @Test
    @DisplayName("limit is enforced per user")
    void limitEnforcedPerUser() {
        var limiter = new AiRateLimiterService(3, 60, null);

        assertThat(limiter.allowTranscribe(1L)).isTrue();
        assertThat(limiter.allowTranscribe(1L)).isTrue();
        assertThat(limiter.allowTranscribe(1L)).isTrue();
        // 4th hit within the window is refused
        assertThat(limiter.allowTranscribe(1L)).isFalse();
    }

    @Test
    @DisplayName("two users have independent budgets — one user's limit doesn't block another")
    void perUserIsolation() {
        var limiter = new AiRateLimiterService(2, 60, null);

        assertThat(limiter.allowTranscribe(1L)).isTrue();
        assertThat(limiter.allowTranscribe(1L)).isTrue();
        assertThat(limiter.allowTranscribe(1L)).isFalse(); // user 1 exhausted

        assertThat(limiter.allowTranscribe(2L)).isTrue();  // user 2 still has budget
        assertThat(limiter.allowTranscribe(2L)).isTrue();
        assertThat(limiter.allowTranscribe(2L)).isFalse();
    }

    @ParameterizedTest
    @ValueSource(ints = { -5, 0, 1 })
    @DisplayName("max is clamped to a positive value (config defenses)")
    void maxClampedToPositive(int configuredMax) {
        var limiter = new AiRateLimiterService(configuredMax, 60, null);

        assertThat(limiter.allowTranscribe(1L)).isTrue();
        // Internally clamped to max(1, configured); after the first hit any subsequent within-
        // window call is refused.
        assertThat(limiter.allowTranscribe(1L)).isFalse();
    }

    @Test
    @DisplayName("retryAfter exposes the configured window for the client")
    void retryAfterExposed() {
        var limiter = new AiRateLimiterService(60, 3600, null);
        assertThat(limiter.transcribeRetryAfterSeconds()).isEqualTo(3600);
    }
}
