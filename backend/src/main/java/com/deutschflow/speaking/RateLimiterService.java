package com.deutschflow.speaking;

import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Per-user speaking-turn rate limiter: at most {@value #MAX_MESSAGES} messages per
 * {@value #WINDOW_SECONDS} seconds per user.
 *
 * <p>Uses Redis sorted-set sliding window (same Lua pattern as {@link AiRateLimiterService} /
 * {@code AuthRateLimiterService}) so the limit is shared across nodes — fixes the O-3 multi-node
 * drift. Falls back to in-memory when Redis is unavailable (single-node behaviour preserved).
 */
@Slf4j
@Service
public class RateLimiterService {

    static final int MAX_MESSAGES = 30;
    static final long WINDOW_SECONDS = 60L;

    private static final String SLIDING_WINDOW_LUA = """
            local clearBefore = tonumber(ARGV[1]) - tonumber(ARGV[2])
            redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, clearBefore)
            local count = redis.call('ZCARD', KEYS[1])
            if count >= tonumber(ARGV[3]) then
              return 0
            end
            redis.call('ZADD', KEYS[1], ARGV[1], ARGV[4])
            redis.call('PEXPIRE', KEYS[1], ARGV[2])
            return 1
            """;

    private final ConcurrentHashMap<Long, Deque<Instant>> inMemoryFallback = new ConcurrentHashMap<>();

    @Nullable private final StringRedisTemplate redis;
    private final DefaultRedisScript<Long> script;
    private final AtomicLong nonce = new AtomicLong();
    private volatile boolean redisDownWarned = false;

    public RateLimiterService(@Nullable StringRedisTemplate redis) {
        this.redis = redis;
        this.script = new DefaultRedisScript<>(SLIDING_WINDOW_LUA, Long.class);
        log.info("[SpeakingRateLimiter] storage={}",
                redis != null ? "Redis + in-memory fallback" : "in-memory only");
    }

    /**
     * Returns {@code true} if the user is within the rate limit and records the turn.
     */
    public boolean checkAndRecord(Long userId) {
        if (redis != null) {
            try {
                long now = System.currentTimeMillis();
                String member = now + "-" + nonce.incrementAndGet();
                Long allowed = redis.execute(
                        script,
                        List.of("rl:speaking|" + userId),
                        Long.toString(now),
                        Long.toString(WINDOW_SECONDS * 1000L),
                        Integer.toString(MAX_MESSAGES),
                        member);
                redisDownWarned = false;
                return allowed != null && allowed == 1L;
            } catch (Exception e) {
                if (!redisDownWarned) {
                    redisDownWarned = true;
                    log.warn("[SpeakingRateLimiter] Redis unavailable — falling back to in-memory: {}",
                            e.getMessage());
                }
            }
        }
        return checkInMemory(userId);
    }

    private boolean checkInMemory(Long userId) {
        Instant now = Instant.now();
        Instant windowStart = now.minusSeconds(WINDOW_SECONDS);
        Deque<Instant> timestamps = inMemoryFallback.computeIfAbsent(userId, k -> new ArrayDeque<>());
        synchronized (timestamps) {
            while (!timestamps.isEmpty() && timestamps.peekFirst().isBefore(windowStart)) {
                timestamps.pollFirst();
            }
            if (timestamps.size() >= MAX_MESSAGES) {
                return false;
            }
            timestamps.addLast(now);
            return true;
        }
    }
}
