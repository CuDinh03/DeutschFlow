package com.deutschflow.user.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory brute-force guard cho auth endpoints.
 *
 * <p>Mỗi endpoint có window và giới hạn riêng — tất cả cấu hình qua {@code app.auth.rate-limit.*}
 * (xem application.yml) nên có thể tinh chỉnh bằng biến môi trường, không cần đổi code:
 * <ul>
 *   <li><b>Login</b>: mặc định 5 lần / 60 giây theo (IP + email) — chặn cả brute-force theo email lẫn credential stuffing.</li>
 *   <li><b>Register</b>: mặc định 10 lần / 600 giây theo IP. Đủ thoáng cho người dùng thật
 *       (gõ nhầm, thử lại, nhiều người chung một IP CGNAT của nhà mạng) trong khi vẫn chặn bot
 *       tạo tài khoản hàng loạt. Cửa sổ 10 phút giúp người gõ nhầm hồi phục sau vài phút thay vì cả giờ.</li>
 *   <li><b>Refresh</b>: mặc định 10 lần / 60 giây theo IP — user hợp lệ có thể mở nhiều tab cùng lúc.</li>
 * </ul>
 *
 * <p>Dữ liệu trong JVM — phù hợp cho single-node. Vì giữ trong bộ nhớ nên restart/redeploy backend
 * sẽ xoá toàn bộ bộ đếm. Khi mở rộng sang multi-node, thay bằng Redis sliding window
 * (Redisson RRateLimiter hoặc Bucket4j + Redis).
 */
@Service
public class AuthRateLimiterService {

    private final int  loginMax;
    private final long loginWindow;     // giây
    private final int  registerMax;
    private final long registerWindow;  // giây
    private final int  refreshMax;
    private final long refreshWindow;   // giây

    private final ConcurrentHashMap<String, Deque<Instant>> loginAttempts    = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Deque<Instant>> registerAttempts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Deque<Instant>> refreshAttempts  = new ConcurrentHashMap<>();

    public AuthRateLimiterService(
            @Value("${app.auth.rate-limit.login-max-per-window:5}")      int  loginMax,
            @Value("${app.auth.rate-limit.login-window-seconds:60}")     long loginWindow,
            @Value("${app.auth.rate-limit.register-max-per-window:10}")  int  registerMax,
            @Value("${app.auth.rate-limit.register-window-seconds:600}") long registerWindow,
            @Value("${app.auth.rate-limit.refresh-max-per-window:10}")   int  refreshMax,
            @Value("${app.auth.rate-limit.refresh-window-seconds:60}")   long refreshWindow) {
        this.loginMax       = Math.max(1, loginMax);
        this.loginWindow    = Math.max(1L, loginWindow);
        this.registerMax    = Math.max(1, registerMax);
        this.registerWindow = Math.max(1L, registerWindow);
        this.refreshMax     = Math.max(1, refreshMax);
        this.refreshWindow  = Math.max(1L, refreshWindow);
    }

    // ─── Public check methods ──────────────────────────────────────────────────

    /**
     * Kiểm tra giới hạn đăng nhập.
     * Key = IP + email (lowercase) để chặn cả brute-force theo email lẫn credential stuffing.
     */
    public boolean allow(String ip, String email) {
        String key = "login|" + safe(ip) + "|" + safe(email).toLowerCase(Locale.ROOT);
        return check(loginAttempts, key, loginMax, loginWindow);
    }

    /** Kiểm tra giới hạn đăng ký — key theo IP. */
    public boolean allowRegister(String ip) {
        return check(registerAttempts, "reg|" + safe(ip), registerMax, registerWindow);
    }

    /** Kiểm tra giới hạn refresh — key theo IP. */
    public boolean allowRefresh(String ip) {
        return check(refreshAttempts, "ref|" + safe(ip), refreshMax, refreshWindow);
    }

    // ─── Retry-After helpers (dùng trong RateLimitExceededException) ──────────

    public int retryAfterSeconds()         { return (int) loginWindow;    }
    public int registerRetryAfterSeconds() { return (int) registerWindow; }
    public int refreshRetryAfterSeconds()  { return (int) refreshWindow;  }

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
