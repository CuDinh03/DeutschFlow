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
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Per-user request-rate guard for expensive AI endpoints. The quota wallet (token budget) is the
 * primary cost control; this limiter sits on top so a single user can't pin an upstream model
 * (Whisper / Groq) with a tight loop and rack up spend or DoS the node before the wallet debits.
 *
 * <p>Mirrors {@code AuthRateLimiterService}: Redis sorted-set sliding window (atomic Lua), shared
 * across nodes, with a per-node in-memory fallback when Redis is unavailable. Keyed by
 * {@code userId} — AI endpoints always have an authenticated principal, and IP would punish
 * shared-NAT users together.
 *
 * <p>Each {@link Bucket} is an independent window. Limits come from {@code app.ai.rate-limit.*}.
 */
@Slf4j
@Service
public class AiRateLimiterService {

    /** Independent per-user windows, one per family of cost-bearing AI endpoints. */
    public enum Bucket {
        /** Whisper STT generic transcribe. */
        TRANSCRIBE,
        /** Whisper STT + pronunciation scoring. */
        PHONEME,
        /** LLM conversation turns (chat + streaming chat). */
        CHAT,
        /** LLM evaluation (mock-exam, Sprechen Teil 2). */
        EVAL,
        /** LLM conversation/session report. */
        REPORT,
        /** Raw LLM text helpers (translate / grammar / generate). */
        TEXT
    }

    private record Limit(int max, long windowSeconds) {}

    private final Map<Bucket, Limit> limits = new EnumMap<>(Bucket.class);
    private final ConcurrentHashMap<String, Deque<Instant>> attempts = new ConcurrentHashMap<>();

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
            @Value("${app.ai.rate-limit.phoneme-max-per-window:60}") int phonemeMax,
            @Value("${app.ai.rate-limit.phoneme-window-seconds:3600}") long phonemeWindow,
            @Value("${app.ai.rate-limit.chat-max-per-window:180}") int chatMax,
            @Value("${app.ai.rate-limit.chat-window-seconds:3600}") long chatWindow,
            @Value("${app.ai.rate-limit.eval-max-per-window:60}") int evalMax,
            @Value("${app.ai.rate-limit.eval-window-seconds:3600}") long evalWindow,
            @Value("${app.ai.rate-limit.report-max-per-window:40}") int reportMax,
            @Value("${app.ai.rate-limit.report-window-seconds:3600}") long reportWindow,
            @Value("${app.ai.rate-limit.text-max-per-window:120}") int textMax,
            @Value("${app.ai.rate-limit.text-window-seconds:3600}") long textWindow,
            @Nullable StringRedisTemplate redis) {
        limits.put(Bucket.TRANSCRIBE, new Limit(Math.max(1, transcribeMax), Math.max(1L, transcribeWindow)));
        limits.put(Bucket.PHONEME, new Limit(Math.max(1, phonemeMax), Math.max(1L, phonemeWindow)));
        limits.put(Bucket.CHAT, new Limit(Math.max(1, chatMax), Math.max(1L, chatWindow)));
        limits.put(Bucket.EVAL, new Limit(Math.max(1, evalMax), Math.max(1L, evalWindow)));
        limits.put(Bucket.REPORT, new Limit(Math.max(1, reportMax), Math.max(1L, reportWindow)));
        limits.put(Bucket.TEXT, new Limit(Math.max(1, textMax), Math.max(1L, textWindow)));
        this.redis = redis;
        this.slidingWindowScript = new DefaultRedisScript<>(SLIDING_WINDOW_LUA, Long.class);
        log.info("[AiRateLimiter] limits={}, storage={}", limits,
                this.redis != null ? "Redis + in-memory fallback" : "in-memory only");
    }

    /** Allow this user one more call in {@code bucket} right now? Records the hit when allowed. */
    public boolean allow(Bucket bucket, long userId) {
        Limit l = limits.get(bucket);
        String key = "ai:" + bucket.name().toLowerCase(Locale.ROOT) + "|" + userId;
        return check(key, l.max(), l.windowSeconds());
    }

    /**
     * Số giây tới khi user có 1 slot trống trở lại trong {@code bucket} (audit 24/07 R-B6).
     *
     * <p>Trước đây {@link #retryAfterSeconds(Bucket)} trả về CẢ window (tới 3600s) — client tuân thủ
     * {@code Retry-After} sẽ bị khoá 1 giờ dù slot mở lại sau vài giây. Với sliding-window, slot kế
     * tiếp mở đúng lúc lần gọi CŨ NHẤT còn trong cửa sổ rời đi ⇒ {@code oldest + window - now}.
     * Không đọc được lần gọi cũ nhất (Redis lỗi / vừa hết hạn) thì trả 1s.
     */
    public int retryAfterSeconds(Bucket bucket, long userId) {
        Limit l = limits.get(bucket);
        String key = "ai:" + bucket.name().toLowerCase(Locale.ROOT) + "|" + userId;
        Long oldestMs = oldestHitMillis(key);
        if (oldestMs == null) {
            return 1;
        }
        long remainMs = l.windowSeconds() * 1000L - (System.currentTimeMillis() - oldestMs);
        if (remainMs <= 1000L) {
            return 1;
        }
        return (int) Math.min(l.windowSeconds(), (remainMs + 999L) / 1000L);
    }

    /** @deprecated dùng {@link #retryAfterSeconds(Bucket, long)} — bản này trả cả window (R-B6). */
    @Deprecated
    public int retryAfterSeconds(Bucket bucket) {
        return (int) limits.get(bucket).windowSeconds();
    }

    /** Mốc ms của lần gọi CŨ NHẤT còn trong cửa sổ, hoặc null nếu không có / không đọc được. */
    private Long oldestHitMillis(String key) {
        if (redis != null) {
            try {
                var oldest = redis.opsForZSet().rangeWithScores("rl:" + key, 0, 0);
                if (oldest != null && !oldest.isEmpty()) {
                    Double score = oldest.iterator().next().getScore();
                    return score != null ? score.longValue() : null;
                }
                return null;
            } catch (Exception e) {
                // fall through to in-memory
            }
        }
        Deque<Instant> deque = attempts.get(key);
        if (deque != null) {
            synchronized (deque) {
                Instant first = deque.peekFirst();
                if (first != null) {
                    return first.toEpochMilli();
                }
            }
        }
        return null;
    }

    private boolean check(String key, int max, long windowSeconds) {
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
        return checkInMemory(key, max, windowSeconds);
    }

    private boolean checkInMemory(String key, int max, long windowSeconds) {
        Instant now = Instant.now();
        Instant windowStart = now.minusSeconds(windowSeconds);

        Deque<Instant> deque = attempts.computeIfAbsent(key, k -> new ArrayDeque<>());
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
