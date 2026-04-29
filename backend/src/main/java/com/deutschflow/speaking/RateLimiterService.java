package com.deutschflow.speaking;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Simple in-memory per-user rate limiter.
 * Allows at most {@code MAX_MESSAGES} messages per {@code WINDOW_SECONDS} seconds per user.
 *
 * <p>Thread-safe: uses {@link ConcurrentHashMap} with synchronized deque access per user.
 */
@Service
public class RateLimiterService {

    private static final int MAX_MESSAGES = 30;
    private static final long WINDOW_SECONDS = 60L;

    private final ConcurrentHashMap<Long, Deque<Instant>> userTimestamps = new ConcurrentHashMap<>();

    /**
     * Checks whether the user is within the rate limit and records the current timestamp.
     *
     * @param userId the authenticated user's ID
     * @return {@code true} if the request is allowed, {@code false} if the rate limit is exceeded
     */
    public boolean checkAndRecord(Long userId) {
        Instant now = Instant.now();
        Instant windowStart = now.minusSeconds(WINDOW_SECONDS);

        Deque<Instant> timestamps = userTimestamps.computeIfAbsent(userId, k -> new ArrayDeque<>());

        synchronized (timestamps) {
            // Remove timestamps outside the current window
            while (!timestamps.isEmpty() && timestamps.peekFirst().isBefore(windowStart)) {
                timestamps.pollFirst();
            }

            if (timestamps.size() >= MAX_MESSAGES) {
                return false; // rate limit exceeded
            }

            timestamps.addLast(now);
            return true;
        }
    }
}
