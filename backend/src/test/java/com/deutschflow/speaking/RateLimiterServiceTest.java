package com.deutschflow.speaking;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimiterServiceTest {

    @Test
    void allowsThirtyMessagesThenBlocks() {
        RateLimiterService limiter = new RateLimiterService();
        long userId = 99_001L;
        for (int i = 0; i < 30; i++) {
            assertThat(limiter.checkAndRecord(userId)).as("message " + i).isTrue();
        }
        assertThat(limiter.checkAndRecord(userId)).isFalse();
    }
}
