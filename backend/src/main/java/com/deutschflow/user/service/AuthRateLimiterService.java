package com.deutschflow.user.service;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory brute-force guard cho auth endpoints.
 *
 * <p>Mỗi endpoint có window và giới hạn riêng:
 * <ul>
 *   <li><b>Login</b>: 5 lần / 60 giây theo (IP + email) — kẻ tấn công phải luân phiên IP lẫn email.</li>
 *   <li><b>Register</b>: 3 lần / 3600 giây theo IP — ngăn tạo tài khoản hàng loạt.</li>
 *   <li><b>Refresh</b>: 10 lần / 60 giây theo IP — user hợp lệ có thể mở nhiều tab cùng lúc.</li>
 * </ul>
 *
 * <p>Dữ liệu trong JVM — phù hợp cho single-node. Khi mở rộng sang multi-node,
 * thay bằng Redis sliding window (Redisson RRateLimiter hoặc Bucket4j + Redis).
 */
@Service
public class AuthRateLimiterService {

    // ─── Login policy ──────────────────────────────────────────────────────────
    /** Tối đa 5 lần đăng nhập / 60 giây theo (IP + email). */
    private static final int  LOGIN_MAX    = 5;
    private static final long LOGIN_WINDOW = 60L;   // giây

    // ─── Register policy ──────────────────────────────────────────────────────
    /** Tối đa 3 lần đăng ký / 1 giờ theo IP. */
    private static final int  REGISTER_MAX    = 3;
    private static final long REGISTER_WINDOW = 3_600L;  // giây

    // ─── Refresh policy ───────────────────────────────────────────────────────
    /** Tối đa 10 lần refresh / 60 giây theo IP. */
    private static final int  REFRESH_MAX    = 10;
    private static final long REFRESH_WINDOW = 60L;   // giây

    private final ConcurrentHashMap<String, Deque<Instant>> loginAttempts    = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Deque<Instant>> registerAttempts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Deque<Instant>> refreshAttempts  = new ConcurrentHashMap<>();

    // ─── Public check methods ──────────────────────────────────────────────────

    /**
     * Kiểm tra giới hạn đăng nhập.
     * Key = IP + email (lowercase) để chặn cả brute-force theo email lẫn credential stuffing.
     */
    public boolean allow(String ip, String email) {
        String key = "login|" + safe(ip) + "|" + safe(email).toLowerCase(Locale.ROOT);
        return check(loginAttempts, key, LOGIN_MAX, LOGIN_WINDOW);
    }

    /** Kiểm tra giới hạn đăng ký — key theo IP. */
    public boolean allowRegister(String ip) {
        return check(registerAttempts, "reg|" + safe(ip), REGISTER_MAX, REGISTER_WINDOW);
    }

    /** Kiểm tra giới hạn refresh — key theo IP. */
    public boolean allowRefresh(String ip) {
        return check(refreshAttempts, "ref|" + safe(ip), REFRESH_MAX, REFRESH_WINDOW);
    }

    // ─── Retry-After helpers (dùng trong RateLimitExceededException) ──────────

    public int retryAfterSeconds()         { return (int) LOGIN_WINDOW;    }
    public int registerRetryAfterSeconds() { return (int) REGISTER_WINDOW; }
    public int refreshRetryAfterSeconds()  { return (int) REFRESH_WINDOW;  }

    // ─── Sliding-window implementation ────────────────────────────────────────

    private boolean check(ConcurrentHashMap<String, Deque<Instant>> store,
                          String key, int max, long windowSeconds) {
        Instant now         = Instant.now();
        Instant windowStart = now.minusSeconds(windowSeconds);

        Deque<Instant> deque = store.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (deque) {
            // Loại bỏ các entry ngoài cửa sổ thời gian
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
