package com.deutschflow.speaking.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Per-session turn guard — prevents concurrent AI turns on the same speaking session.
 *
 * <p>When Redis is available, the lock is stored as a Redis key with a 30s safety-TTL so it is
 * automatically released if the request dies without calling {@link #release}. This makes the guard
 * safe across multiple nodes (S-6). Falls back to the in-memory {@link ConcurrentHashMap} +
 * {@link AtomicBoolean} implementation (single-node only) when Redis is unavailable.
 */
@Component
@Slf4j
public class SessionTurnGuard {

    private static final String KEY_PREFIX = "session-turn:";
    // Auto-expire after 30 s — a speaking turn is 2-10 s; 30 s is a generous safety net.
    private static final Duration LOCK_TTL = Duration.ofSeconds(30);

    // In-memory fallback (single-node)
    private final ConcurrentHashMap<Long, AtomicBoolean> activeTurns = new ConcurrentHashMap<>();

    @Nullable
    private final StringRedisTemplate redis;
    private volatile boolean redisDownWarned = false;

    public SessionTurnGuard(@Nullable StringRedisTemplate redis) {
        this.redis = redis;
        log.info("[SessionTurnGuard] storage = {}",
                redis != null ? "Redis (shared, multi-node safe)" : "in-memory (single-node only)");
    }

    /**
     * Try to acquire the turn lock for {@code sessionId}.
     *
     * @return {@code true} when the lock was acquired, {@code false} when another thread/node already
     *         holds it
     */
    public boolean tryAcquire(long sessionId) {
        if (redis != null) {
            try {
                Boolean set = redis.opsForValue().setIfAbsent(
                        KEY_PREFIX + sessionId, "1", LOCK_TTL);
                boolean acquired = Boolean.TRUE.equals(set);
                redisDownWarned = false;
                if (!acquired) {
                    log.debug("[SessionTurnGuard] session {} is already processing an active turn", sessionId);
                }
                return acquired;
            } catch (Exception e) {
                if (!redisDownWarned) {
                    redisDownWarned = true;
                    log.warn("[SessionTurnGuard] Redis unavailable — falling back to in-memory (single-node): {}",
                            e.getMessage());
                }
            }
        }

        // In-memory fallback
        AtomicBoolean flag = activeTurns.computeIfAbsent(sessionId, id -> new AtomicBoolean(false));
        boolean acquired = flag.compareAndSet(false, true);
        if (!acquired) {
            log.debug("[SessionTurnGuard] session {} is already processing an active turn (in-memory)", sessionId);
        }
        return acquired;
    }

    /** Release the turn lock for {@code sessionId}. */
    public void release(long sessionId) {
        if (redis != null) {
            try {
                redis.delete(KEY_PREFIX + sessionId);
                redisDownWarned = false;
                return;
            } catch (Exception e) {
                if (!redisDownWarned) {
                    redisDownWarned = true;
                    log.warn("[SessionTurnGuard] Redis unavailable on release — falling back to in-memory: {}",
                            e.getMessage());
                }
            }
        }

        // In-memory fallback
        AtomicBoolean flag = activeTurns.get(sessionId);
        if (flag != null) {
            flag.set(false);
        }
    }
}
