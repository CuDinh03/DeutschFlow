package com.deutschflow.speaking;

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
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Per-user rate limit for expensive AI endpoints (Whisper transcribe today; ready to extend to
 * other LLM-backed helpers). The quota wallet (token budget) is still the primary control on
 * cost — this limiter is a request-rate guard on top of it, so a single user can't pin the
 * Whisper API with a tight loop and DoS the system or rack up surprise spend before the wallet
 * notices.
 *
 * <p>Mirrors {@code AuthRateLimiterService}: Redis sorted-set sliding window (atomic Lua), shared
 * across nodes, with a per-node in-memory fallback when Redis is unavailable. Keyed by
 * {@code userId}, NOT by IP — for AI endpoints we always have an authenticated principal, and IP
 * would punish shared NAT users together.
 *
 * <p>Defaults (overridable via {@code app.ai.rate-limit.*}):
 * <ul>
 *   <li>{@code transcribe}: 60 requests / 3600s per user — covers a full hour of high-frequency
 *       speaking practice (~one request per minute), still curtails a hostile loop.</li>
 * </ul>
 */
@Slf4j
@Service
public class AiRateLimiterService {

    private final int transcribeMax;
    private final long transcribeWindow;

    private final ConcurrentHashMap<String, Deque<Instant>> transcribeAttempts = new ConcurrentHashMap<>();

    private final StringRedisTemplate redis;
    private final DefaultRedisScript<Long> slidingWindowScript;
    private final AtomicLong nonce = new AtomicLong();
    private volatile boolean redisDownWarned = false;

    /**
     * KEYS[1] = sorted-set key, ARGV[1] = now(ms), ARGV[2] = window(ms),
     * ARGV[3] = max, ARGV[4] = unique zset member. Returns 1 when allowed (and records the hit),
     * 0 when the limit is reached.
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

    public AiRateLimiterService(
            @Value("${app.ai.rate-limit.transcribe-max-per-window:60}") int transcribeMax,
            @Value("${app.ai.rate-limit.transcribe-window-seconds:3600}") long transcribeWindow,
            @Nullable StringRedisTemplate redis) {
        this.transcribeMax = Math.max(1, transcribeMax);
        this.transcribeWindow = Math.max(1L, transcribeWindow);
        this.redis = redis;
        this.slidingWindowScript = new DefaultRedisScript<>(SLIDING_WINDOW_LUA, Long.class);
        log.info("[AiRateLimiter] transcribe limit = {}/{}s, storage = {}",
                this.transcribeMax, this.transcribeWindow,
                this.redis != null ? "Redis + in-memory fallback" : "in-memory only");
    }

    /** Allow this user to call /transcribe right now? */
    public boolean allowTranscribe(long userId) {
        return check(transcribeAttempts, "ai:transcribe|" + userId, transcribeMax, transcribeWindow);
    }

    /** Seconds the client should wait before retrying after a refusal. */
    public int transcribeRetryAfterSeconds() {
        return (int) transcribeWindow;
    }

    private boolean check(ConcurrentHashMap<String, Deque<Instant>> fallbackStore,
                          String key, int max, long windowSeconds) {
        if (redis != null) {
            try {
                long now = System.currentTimeMillis();
                String member = now + "-" + nonce.incrementAndGet();
                Long allowed = redis.execute(
                        slidingWindowScript,
                        List.of("rl:" + key),
                        Long.toString(now),
                        Long.toString(windowSeconds * 1000L),
                        Integer.toString(max),
                        member);
                redisDownWarned = false;
                return allowed != null && allowed == 1L;
            } catch (Exception e) {
                if (!redisDownWarned) {
                    redisDownWarned = true;
                    log.warn("[AiRateLimiter] Redis unavailable — falling back to in-memory: {}",
                            e.getMessage());
                }
                // fall through to in-memory
            }
        }
        return checkInMemory(fallbackStore, key, max, windowSeconds);
    }

    private boolean checkInMemory(ConcurrentHashMap<String, Deque<Instant>> store,
                                  String key, int max, long windowSeconds) {
        Instant now = Instant.now();
        Instant windowStart = now.minusSeconds(windowSeconds);

        Deque<Instant> deque = store.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (deque) {
            while (!deque.isEmpty() && deque.peekFirst().isBefore(windowStart)) {
                deque.pollFirst();
            }
            if (deque.size() >= max) {
                return false;
            }
            deque.addLast(now);
            return true;
        }
    }
}
