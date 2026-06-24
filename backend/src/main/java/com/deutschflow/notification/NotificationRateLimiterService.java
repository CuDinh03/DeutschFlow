package com.deutschflow.notification;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Per-user rate limit for notification endpoints (read-poll / mutate / SSE-connect), sliding window.
 *
 * <p><b>Storage (S-9):</b> a <b>Redis</b> sorted-set sliding window (atomic Lua), so the limit is
 * shared across nodes; it degrades safely to a per-node in-memory window when Redis is unavailable.
 * Previously this was in-memory only — on N nodes a user effectively got N× the intended budget, and
 * the maps were never globally swept. Mirrors {@code AuthRateLimiterService}.
 */
@Slf4j
@Service
public class NotificationRateLimiterService {

    private final int readMaxPerWindow;
    private final int readWindowSeconds;
    private final int mutateMaxPerWindow;
    private final int mutateWindowSeconds;
    private final int streamConnectMaxPerWindow;
    private final int streamConnectWindowSeconds;

    // In-memory fallback (used when Redis is unavailable). Key already namespaces by category.
    private final ConcurrentHashMap<String, Deque<Instant>> windows = new ConcurrentHashMap<>();

    // Redis sliding window (primary). May be null if no Redis is configured.
    private final StringRedisTemplate redis;
    private final DefaultRedisScript<Long> slidingWindowScript;
    private final AtomicLong nonce = new AtomicLong();
    private volatile boolean redisDownWarned = false;

    /**
     * Atomic sliding-window check.
     * KEYS[1]=zset key; ARGV[1]=now(ms); ARGV[2]=window(ms); ARGV[3]=max; ARGV[4]=unique member.
     * Returns 1 when allowed (and records the hit), 0 when the limit is reached.
     */
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

    public NotificationRateLimiterService(
            @Value("${app.notifications.rate-limit.read-max-per-window:120}") int readMaxPerWindow,
            @Value("${app.notifications.rate-limit.read-window-seconds:60}") int readWindowSeconds,
            @Value("${app.notifications.rate-limit.mutate-max-per-window:40}") int mutateMaxPerWindow,
            @Value("${app.notifications.rate-limit.mutate-window-seconds:60}") int mutateWindowSeconds,
            @Value("${app.notifications.rate-limit.stream-connect-max-per-window:12}") int streamConnectMaxPerWindow,
            @Value("${app.notifications.rate-limit.stream-connect-window-seconds:60}") int streamConnectWindowSeconds,
            @Nullable StringRedisTemplate redis) {
        this.readMaxPerWindow = Math.max(1, readMaxPerWindow);
        this.readWindowSeconds = Math.max(1, readWindowSeconds);
        this.mutateMaxPerWindow = Math.max(1, mutateMaxPerWindow);
        this.mutateWindowSeconds = Math.max(1, mutateWindowSeconds);
        this.streamConnectMaxPerWindow = Math.max(1, streamConnectMaxPerWindow);
        this.streamConnectWindowSeconds = Math.max(1, streamConnectWindowSeconds);
        this.redis = redis;
        this.slidingWindowScript = new DefaultRedisScript<>(SLIDING_WINDOW_LUA, Long.class);
        log.info("[NotificationRateLimiter] storage = {}",
                this.redis != null ? "Redis (shared) + in-memory fallback" : "in-memory only");
    }

    public boolean allowReadPoll(Long userId) {
        return check(key(userId, "poll"), readMaxPerWindow, readWindowSeconds);
    }

    public boolean allowMutate(Long userId) {
        return check(key(userId, "mutate"), mutateMaxPerWindow, mutateWindowSeconds);
    }

    public boolean allowStreamConnect(Long userId) {
        return check(key(userId, "sse"), streamConnectMaxPerWindow, streamConnectWindowSeconds);
    }

    public int retryAfterSeconds(String category) {
        return switch (category) {
            case "poll" -> readWindowSeconds;
            case "mutate" -> mutateWindowSeconds;
            case "sse" -> streamConnectWindowSeconds;
            default -> 60;
        };
    }

    private static String key(Long userId, String category) {
        return userId + "|" + category.toLowerCase(Locale.ROOT);
    }

    // ─── Sliding-window: Redis primary, in-memory fallback ────────────────────

    private boolean check(String key, int max, int windowSeconds) {
        if (redis != null) {
            try {
                long now = System.currentTimeMillis();
                String member = now + "-" + nonce.incrementAndGet();
                Long allowed = redis.execute(
                        slidingWindowScript,
                        List.of("rlnoti:" + key),
                        Long.toString(now),
                        Long.toString((long) Math.max(1, windowSeconds) * 1000L),
                        Integer.toString(Math.max(1, max)),
                        member);
                redisDownWarned = false;
                return allowed != null && allowed == 1L;
            } catch (Exception e) {
                if (!redisDownWarned) {
                    redisDownWarned = true;
                    log.warn("[NotificationRateLimiter] Redis unavailable — falling back to in-memory per-node limiting: {}",
                            e.getMessage());
                }
                // fall through to in-memory
            }
        }
        return checkInMemory(key, max, windowSeconds);
    }

    private boolean checkInMemory(String key, int max, int windowSeconds) {
        Instant now = Instant.now();
        Instant windowStart = now.minusSeconds(Math.max(1, windowSeconds));
        Deque<Instant> deque = windows.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (deque) {
            while (!deque.isEmpty() && deque.peekFirst().isBefore(windowStart)) {
                deque.pollFirst();
            }
            if (deque.size() >= Math.max(1, max)) {
                return false;
            }
            deque.addLast(now);
            return true;
        }
    }
}
