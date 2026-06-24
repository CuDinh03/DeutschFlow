package com.deutschflow.notification;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * S-9: exercises the in-memory fallback path (constructed with a null Redis template) — the same
 * sliding-window logic used when Redis is unavailable. The Redis primary path mirrors
 * {@code AuthRateLimiterService} and is covered there.
 */
class NotificationRateLimiterServiceUnitTest {

    /** max=2 per 60s for every category; null Redis → in-memory fallback. */
    private NotificationRateLimiterService limiter() {
        return new NotificationRateLimiterService(2, 60, 2, 60, 2, 60, null);
    }

    @Test
    @DisplayName("allows up to max then blocks within the window")
    void allowsUpToMaxThenBlocks() {
        var rl = limiter();
        assertThat(rl.allowReadPoll(1L)).isTrue();
        assertThat(rl.allowReadPoll(1L)).isTrue();
        assertThat(rl.allowReadPoll(1L)).isFalse(); // 3rd hit exceeds max=2
    }

    @Test
    @DisplayName("limits are independent per user")
    void independentPerUser() {
        var rl = limiter();
        assertThat(rl.allowMutate(1L)).isTrue();
        assertThat(rl.allowMutate(1L)).isTrue();
        assertThat(rl.allowMutate(1L)).isFalse();
        // a different user has their own budget
        assertThat(rl.allowMutate(2L)).isTrue();
    }

    @Test
    @DisplayName("limits are independent per category for the same user")
    void independentPerCategory() {
        var rl = limiter();
        assertThat(rl.allowReadPoll(7L)).isTrue();
        assertThat(rl.allowReadPoll(7L)).isTrue();
        assertThat(rl.allowReadPoll(7L)).isFalse();        // poll exhausted
        assertThat(rl.allowMutate(7L)).isTrue();           // mutate unaffected
        assertThat(rl.allowStreamConnect(7L)).isTrue();    // sse unaffected
    }

    @Test
    @DisplayName("retryAfterSeconds maps each category to its window")
    void retryAfterByCategory() {
        var rl = new NotificationRateLimiterService(1, 30, 1, 45, 1, 90, null);
        assertThat(rl.retryAfterSeconds("poll")).isEqualTo(30);
        assertThat(rl.retryAfterSeconds("mutate")).isEqualTo(45);
        assertThat(rl.retryAfterSeconds("sse")).isEqualTo(90);
        assertThat(rl.retryAfterSeconds("other")).isEqualTo(60);
    }
}
