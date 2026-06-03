package com.deutschflow.user.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.lang.Nullable;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Brute-force / abuse guard for auth endpoints (sliding window).
 *
 * <p>Per-endpoint windows + limits are configured via {@code app.auth.rate-limit.*} (see
 * application.yml) so they can be tuned by env var without code changes:
 * <ul>
 *   <li><b>Login</b>: 5/60s per (IP + email).</li>
 *   <li><b>Register</b>: 10/600s per IP.</li>
 *   <li><b>Refresh</b>: 10/60s per IP.</li>
 *   <li><b>Password reset</b>: 5/900s per (IP + email).</li>
 * </ul>
 *
 * <p><b>Storage (S16):</b> the counter is a <b>Redis</b> sorted-set sliding window (atomic Lua), so
 * the limit is shared across nodes. If Redis is unavailable, it <b>degrades safely</b> to a per-node
 * in-memory window — auth keeps working (no lockout) with best-effort protection until Redis returns.
 */
@Slf4j
@Service
public class AuthRateLimiterService {

    private final int  loginMax;
    private final long loginWindow;     // giây
    private final int  registerMax;
    private final long registerWindow;  // giây
    private final int  refreshMax;
    private final long refreshWindow;   // giây
    private final int  passwordResetMax;
    private final long passwordResetWindow;  // giây

    // In-memory fallback (used when Redis is unavailable).
    private final ConcurrentHashMap<String, Deque<Instant>> loginAttempts    = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Deque<Instant>> registerAttempts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Deque<Instant>> refreshAttempts  = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Deque<Instant>> passwordResetAttempts = new ConcurrentHashMap<>();

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

    public AuthRateLimiterService(
            @Value("${app.auth.rate-limit.login-max-per-window:5}")      int  loginMax,
            @Value("${app.auth.rate-limit.login-window-seconds:60}")     long loginWindow,
            @Value("${app.auth.rate-limit.register-max-per-window:10}")  int  registerMax,
            @Value("${app.auth.rate-limit.register-window-seconds:600}") long registerWindow,
            @Value("${app.auth.rate-limit.refresh-max-per-window:10}")   int  refreshMax,
            @Value("${app.auth.rate-limit.refresh-window-seconds:60}")   long refreshWindow,
            @Value("${app.auth.rate-limit.password-reset-max-per-window:5}")    int  passwordResetMax,
            @Value("${app.auth.rate-limit.password-reset-window-seconds:900}")  long passwordResetWindow,
            @Nullable StringRedisTemplate redis) {
        this.loginMax       = Math.max(1, loginMax);
        this.loginWindow    = Math.max(1L, loginWindow);
        this.registerMax    = Math.max(1, registerMax);
        this.registerWindow = Math.max(1L, registerWindow);
        this.refreshMax     = Math.max(1, refreshMax);
        this.refreshWindow  = Math.max(1L, refreshWindow);
        this.passwordResetMax    = Math.max(1, passwordResetMax);
        this.passwordResetWindow = Math.max(1L, passwordResetWindow);

        this.redis = redis;
        this.slidingWindowScript = new DefaultRedisScript<>(SLIDING_WINDOW_LUA, Long.class);
        log.info("[RateLimiter] storage = {}", this.redis != null ? "Redis (shared) + in-memory fallback" : "in-memory only");
    }

    // ─── Public check methods ──────────────────────────────────────────────────

    /** Login limit. Key = IP + email (lowercase) — blocks both email brute-force and credential stuffing. */
    public boolean allow(String ip, String email) {
        String key = "login|" + safe(ip) + "|" + safe(email).toLowerCase(Locale.ROOT);
        return check(loginAttempts, key, loginMax, loginWindow);
    }

    /** Register limit — keyed by IP. */
    public boolean allowRegister(String ip) {
        return check(registerAttempts, "reg|" + safe(ip), registerMax, registerWindow);
    }

    /** Refresh limit — keyed by IP. */
    public boolean allowRefresh(String ip) {
        return check(refreshAttempts, "ref|" + safe(ip), refreshMax, refreshWindow);
    }

    /** Forgot/reset-password limit — keyed by (IP + email). Blocks email-bombing + 6-digit OTP brute-force. */
    public boolean allowPasswordReset(String ip, String email) {
        String key = "pwreset|" + safe(ip) + "|" + safe(email).toLowerCase(Locale.ROOT);
        return check(passwordResetAttempts, key, passwordResetMax, passwordResetWindow);
    }

    // ─── Retry-After helpers (used in RateLimitExceededException) ──────────────

    public int retryAfterSeconds()         { return (int) loginWindow;    }
    public int registerRetryAfterSeconds() { return (int) registerWindow; }
    public int refreshRetryAfterSeconds()  { return (int) refreshWindow;  }
    public int passwordResetRetryAfterSeconds() { return (int) passwordResetWindow; }

    // ─── Sliding-window: Redis primary, in-memory fallback ────────────────────

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
                    log.warn("[RateLimiter] Redis unavailable — falling back to in-memory per-node limiting: {}",
                            e.getMessage());
                }
                // fall through to in-memory
            }
        }
        return checkInMemory(fallbackStore, key, max, windowSeconds);
    }

    private boolean checkInMemory(ConcurrentHashMap<String, Deque<Instant>> store,
                                  String key, int max, long windowSeconds) {
        Instant now         = Instant.now();
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

    private static String safe(String s) {
        return s == null ? "" : s.trim();
    }
}
