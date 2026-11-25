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
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Brute-force / abuse guard for auth endpoints (sliding window).
 *
 * <p>Per-endpoint windows + limits are configured via {@code app.auth.rate-limit.*} (see
 * application.yml) so they can be tuned by env var without code changes:
 * <ul>
 *   <li><b>Login</b>: two independent budgets, both must pass —
 *       5/60s per (IP + email) <i>and</i> 100/60s per IP alone.</li>
 *   <li><b>Register</b>: 10/600s per IP.</li>
 *   <li><b>Refresh</b>: 10/60s per IP.</li>
 *   <li><b>Password reset</b>: 5/900s per (IP + email).</li>
 *   <li><b>Registration PIN send</b> (start + resend): 5/3600s per <i>email</i> (hashed in the key).</li>
 *   <li><b>Registration PIN verify</b>: 30/600s per IP.</li>
 * </ul>
 *
 * <p><b>Why login needs two budgets:</b> the (IP + email) key stops credential-stuffing against one
 * account, but it can never stop a flood — an attacker who changes the email on every request mints a
 * fresh bucket each time. That is not merely a bypass of a counter: a login attempt costs a full
 * BCrypt hash <i>even for an email that does not exist</i>, because Spring's
 * {@code DaoAuthenticationProvider} runs {@code mitigateAgainstTimingAttack()} on unknown users. At
 * BCrypt cost 10 (~50-100ms of CPU) a single IP could therefore saturate the box. The per-IP budget
 * is the one that does not move when the email does. It is deliberately loose (see
 * {@code app.auth.rate-limit.login-ip-*}) so a whole class logging in from one school/CGNAT address
 * is not locked out — it removes the single-IP kill, it is not a substitute for an edge rate limit.
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
    private final int  loginIpMax;
    private final long loginIpWindow;   // giây
    private final int  registerMax;
    private final long registerWindow;  // giây
    private final int  refreshMax;
    private final long refreshWindow;   // giây
    private final int  passwordResetMax;
    private final long passwordResetWindow;  // giây

    // In-memory fallback (used when Redis is unavailable).
    private final ConcurrentHashMap<String, Deque<Instant>> loginAttempts    = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Deque<Instant>> loginIpAttempts  = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Deque<Instant>> registerAttempts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Deque<Instant>> refreshAttempts  = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Deque<Instant>> passwordResetAttempts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Deque<Instant>> registrationSendAttempts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Deque<Instant>> registrationVerifyAttempts = new ConcurrentHashMap<>();

    // Mã PIN đăng ký. Tiêm theo FIELD (không thêm tham số constructor) để không đụng các test đang
    // dựng lớp này bằng tay; giá trị khởi tạo là mặc định khi lớp được dựng ngoài Spring.
    @Value("${app.auth.rate-limit.registration-send-max-per-window:5}")
    private int  registrationSendMax = 5;
    @Value("${app.auth.rate-limit.registration-send-window-seconds:3600}")
    private long registrationSendWindow = 3600;
    @Value("${app.auth.rate-limit.registration-verify-ip-max-per-window:30}")
    private int  registrationVerifyIpMax = 30;
    @Value("${app.auth.rate-limit.registration-verify-ip-window-seconds:600}")
    private long registrationVerifyIpWindow = 600;

    // Tạo phiên onboarding khách (chống bot 07/11/2026). Bộ lọc công khai chung cho 120 request/phút/IP —
    // đủ cho PATCH dồn dập của một người, nhưng nghĩa là một IP tạo được ~170k phiên/ngày (mỗi phiên một
    // dòng DB). Một người chỉ cần vài phiên; 60/giờ/IP vẫn đủ cho cả một lớp học sau cùng một NAT.
    private final ConcurrentHashMap<String, Deque<Instant>> guestSessionCreateAttempts = new ConcurrentHashMap<>();
    @Value("${app.auth.rate-limit.guest-session-create-max-per-window:60}")
    private int  guestSessionCreateMax = 60;
    @Value("${app.auth.rate-limit.guest-session-create-window-seconds:3600}")
    private long guestSessionCreateWindow = 3600;

    // Xác thực hai lớp (09/11/2026). Đếm LẦN SAI (lần đúng được trả chỗ): 5 lần sai / 15 phút theo người dùng
    // VÀ theo IP — chạm một trong hai là 429 tới hết cửa sổ. Mỗi lượt GIỮ CHỖ trước khi kiểm mã
    // (tryAcquireMfaAttempt) nên lượt đang kiểm dở cũng chiếm ngân sách. Gửi mã email 2FA: 5 thư / giờ / người dùng.
    private final ConcurrentHashMap<String, Deque<MfaMark>> mfaFailureAttempts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Deque<Instant>> mfaEmailSendAttempts = new ConcurrentHashMap<>();
    @Value("${app.auth.rate-limit.mfa-failure-max-per-window:5}")
    private int  mfaFailureMax = 5;
    @Value("${app.auth.rate-limit.mfa-failure-window-seconds:900}")
    private long mfaFailureWindow = 900;
    @Value("${app.auth.rate-limit.mfa-email-send-max-per-window:5}")
    private int  mfaEmailSendMax = 5;
    @Value("${app.auth.rate-limit.mfa-email-send-window-seconds:3600}")
    private long mfaEmailSendWindow = 3600;

    // Redis sliding window (primary). May be null if no Redis is configured.
    private final StringRedisTemplate redis;
    private final DefaultRedisScript<Long> slidingWindowScript;
    private final DefaultRedisScript<Long> countScript;
    private final DefaultRedisScript<Long> reserveScript;
    private final DefaultRedisScript<Long> waitScript;
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

    /**
     * Giữ chỗ (2FA): như {@link #SLIDING_WINDOW_LUA} nhưng trả SỐ LƯỢT sau khi ghi (≥ 1), hoặc 0 khi đã đầy.
     * KEYS[1]=zset key; ARGV[1]=now(ms); ARGV[2]=window(ms); ARGV[3]=max; ARGV[4]=unique member.
     */
    private static final String RESERVE_LUA = """
            local clearBefore = tonumber(ARGV[1]) - tonumber(ARGV[2])
            redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, clearBefore)
            local count = redis.call('ZCARD', KEYS[1])
            if count >= tonumber(ARGV[3]) then
              return 0
            end
            redis.call('ZADD', KEYS[1], ARGV[1], ARGV[4])
            redis.call('PEXPIRE', KEYS[1], ARGV[2])
            return count + 1
            """;

    /**
     * Chờ bao lâu (ms) tới khi khoá có lại một chỗ, không ghi: KEYS[1]=zset key; ARGV[1]=now(ms); ARGV[2]=window(ms);
     * ARGV[3]=max. Còn chỗ → 0; đầy → (điểm của lượt phải rời cửa sổ) + window − now.
     */
    private static final String WAIT_LUA = """
            local now = tonumber(ARGV[1])
            local window = tonumber(ARGV[2])
            redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - window)
            local count = redis.call('ZCARD', KEYS[1])
            local max = tonumber(ARGV[3])
            if count < max then
              return 0
            end
            local e = redis.call('ZRANGE', KEYS[1], count - max, count - max, 'WITHSCORES')
            if e[2] == nil then
              return 0
            end
            local wait = tonumber(e[2]) + window - now
            if wait < 0 then
              return 0
            end
            return math.floor(wait)
            """;

    /** Đếm không ghi: KEYS[1]=zset key; ARGV[1]=now(ms); ARGV[2]=window(ms). */
    private static final String COUNT_LUA = """
            local clearBefore = tonumber(ARGV[1]) - tonumber(ARGV[2])
            redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, clearBefore)
            return redis.call('ZCARD', KEYS[1])
            """;

    public AuthRateLimiterService(
            @Value("${app.auth.rate-limit.login-max-per-window:5}")             int  loginMax,
            @Value("${app.auth.rate-limit.login-window-seconds:60}")            long loginWindow,
            @Value("${app.auth.rate-limit.login-ip-max-per-window:100}")        int  loginIpMax,
            @Value("${app.auth.rate-limit.login-ip-window-seconds:60}")         long loginIpWindow,
            @Value("${app.auth.rate-limit.register-max-per-window:10}")         int  registerMax,
            @Value("${app.auth.rate-limit.register-window-seconds:600}")        long registerWindow,
            @Value("${app.auth.rate-limit.refresh-max-per-window:10}")          int  refreshMax,
            @Value("${app.auth.rate-limit.refresh-window-seconds:60}")          long refreshWindow,
            @Value("${app.auth.rate-limit.password-reset-max-per-window:5}")    int  passwordResetMax,
            @Value("${app.auth.rate-limit.password-reset-window-seconds:900}")  long passwordResetWindow,
            @Nullable StringRedisTemplate redis) {
        this.loginMax       = Math.max(1, loginMax);
        this.loginWindow    = Math.max(1L, loginWindow);
        this.loginIpMax     = Math.max(1, loginIpMax);
        this.loginIpWindow  = Math.max(1L, loginIpWindow);
        this.registerMax    = Math.max(1, registerMax);
        this.registerWindow = Math.max(1L, registerWindow);
        this.refreshMax     = Math.max(1, refreshMax);
        this.refreshWindow  = Math.max(1L, refreshWindow);
        this.passwordResetMax    = Math.max(1, passwordResetMax);
        this.passwordResetWindow = Math.max(1L, passwordResetWindow);

        this.redis = redis;
        this.slidingWindowScript = new DefaultRedisScript<>(SLIDING_WINDOW_LUA, Long.class);
        this.countScript = new DefaultRedisScript<>(COUNT_LUA, Long.class);
        this.reserveScript = new DefaultRedisScript<>(RESERVE_LUA, Long.class);
        this.waitScript = new DefaultRedisScript<>(WAIT_LUA, Long.class);
        log.info("[RateLimiter] storage = {}", this.redis != null ? "Redis (shared) + in-memory fallback" : "in-memory only");
    }

    // ─── Public check methods ──────────────────────────────────────────────────

    /** Login limit. Key = IP + email (lowercase) — blocks both email brute-force and credential stuffing. */
    public boolean allow(String ip, String email) {
        String key = "login|" + safe(ip) + "|" + safe(email).toLowerCase(Locale.ROOT);
        return check(loginAttempts, key, loginMax, loginWindow);
    }

    /**
     * Login limit keyed by IP <b>alone</b> — the budget an attacker cannot reset by changing the
     * email. Checked in addition to {@link #allow(String, String)}, not instead of it: the two
     * budgets are independent, and a request must pass both.
     */
    public boolean allowLoginPerIp(String ip) {
        return check(loginIpAttempts, "login-ip|" + safe(ip), loginIpMax, loginIpWindow);
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

    /**
     * Trần GỬI mã PIN đăng ký (start + resend) theo EMAIL. Email được băm trước khi thành khoá Redis —
     * Redis không giữ email thô của người chưa thành người dùng.
     */
    public boolean allowRegistrationSend(String email) {
        String key = "regsend|" + sha256Hex(safe(email).toLowerCase(Locale.ROOT));
        return check(registrationSendAttempts, key, Math.max(1, registrationSendMax), Math.max(1L, registrationSendWindow));
    }

    /** Trần verify mã PIN theo IP — chống dò mã trên nhiều email cùng lúc. */
    public boolean allowRegistrationVerifyPerIp(String ip) {
        return check(registrationVerifyAttempts, "regverify-ip|" + safe(ip),
                Math.max(1, registrationVerifyIpMax), Math.max(1L, registrationVerifyIpWindow));
    }

    /** Trần TẠO phiên onboarding khách theo IP. */
    public boolean allowGuestSessionCreate(String ip) {
        return check(guestSessionCreateAttempts, "guest-create|" + safe(ip),
                Math.max(1, guestSessionCreateMax), Math.max(1L, guestSessionCreateWindow));
    }

    // ─── 2FA ───────────────────────────────────────────────────────────────────

    /**
     * Đã đủ số lượt 2FA (lần sai + lượt đang kiểm dở) trong cửa sổ — theo người dùng HOẶC theo IP? Chỉ ĐỌC.
     * Chỉ để quan sát/kiểm thử: đường kiểm mã phải dùng {@link #tryAcquireMfaAttempt} (đọc-rồi-ghi tách rời thì
     * N request song song cùng lọt qua bước đọc).
     */
    public boolean isMfaBlocked(long userId, String ip) {
        long window = Math.max(1L, mfaFailureWindow);
        int max = Math.max(1, mfaFailureMax);
        return countMfaInWindow(mfaUserKey(userId), window) >= max
                || countMfaInWindow(mfaIpKey(ip), window) >= max;
    }

    /**
     * Một lượt nhập mã 2FA đã GIỮ CHỖ trong cả hai ngân sách (người dùng + IP). Kết thúc bằng đúng MỘT trong hai:
     * {@link #commitMfaFailure} (mã sai — chỗ giữ thành một lần sai) hoặc {@link #refundMfaAttempt} (mã đúng,
     * hoặc request hỏng vì lý do không phải đoán mã — trả lại chỗ). Gọi lần hai là no-op.
     */
    public static final class MfaAttempt {
        private final List<MfaSlot> slots;
        private final boolean reachesLimit;
        private final AtomicBoolean settled = new AtomicBoolean();

        private MfaAttempt(List<MfaSlot> slots, boolean reachesLimit) {
            this.slots = slots;
            this.reachesLimit = reachesLimit;
        }

        /** Nếu lượt này thành lần sai thì một ngân sách chạm trần. */
        public boolean reachesLimit() {
            return reachesLimit;
        }
    }

    /**
     * Một chỗ giữ trong một khoá: Redis (member của ZSET) hoặc bộ nhớ của node (phần tử {@link MfaMark}, so bằng ==).
     * Member Redis mang nhãn để admin gỡ khoá đúng người (xem {@link #clearMfaFailuresForUser}): ở khoá người dùng
     * là {@code <ms>-<n>|<ip>}, ở khoá IP là {@code <ms>-<n>|u<userId>}.
     */
    private record MfaSlot(String key, boolean redis, String member, MfaMark mark, long countAfter) {}

    /** Phần tử của hàng đợi bộ nhớ (khi Redis hỏng): thời điểm + ai/ở đâu, để gỡ khoá theo người dùng. */
    private static final class MfaMark {
        final Instant at;
        final long userId;
        final String ip;

        MfaMark(Instant at, long userId, String ip) {
            this.at = at;
            this.userId = userId;
            this.ip = ip;
        }
    }

    /**
     * GIỮ CHỖ NGUYÊN TỬ cho một lượt nhập mã 2FA, TRƯỚC khi kiểm mã: mỗi ngân sách đếm lần sai + lượt đang kiểm dở;
     * đã đủ {@code mfa-failure-max-per-window} thì từ chối (kể cả khi mã đúng). Đếm-và-ghi chạy trong một bước
     * (Lua trên Redis; khoá trên hàng đợi khi rơi về bộ nhớ) nên N request song song không cùng lọt qua được
     * — trước đây kiểm chỉ-đọc rồi mới ghi lần sai, 20 lượt đoán song song đều qua bước kiểm.
     *
     * @return rỗng khi một trong hai ngân sách đã đầy (người gọi trả 429)
     */
    public Optional<MfaAttempt> tryAcquireMfaAttempt(long userId, String ip) {
        long window = Math.max(1L, mfaFailureWindow);
        int max = Math.max(1, mfaFailureMax);
        String safeIp = safe(ip);
        MfaSlot userSlot = reserveMfaSlot(mfaUserKey(userId), "|" + safeIp, userId, safeIp, max, window);
        if (userSlot == null) {
            return Optional.empty();
        }
        MfaSlot ipSlot = reserveMfaSlot(mfaIpKey(ip), "|u" + userId, userId, safeIp, max, window);
        if (ipSlot == null) {
            releaseMfaSlot(userSlot);
            return Optional.empty();
        }
        return Optional.of(new MfaAttempt(List.of(userSlot, ipSlot),
                userSlot.countAfter() >= max || ipSlot.countAfter() >= max));
    }

    /**
     * Lượt đã giữ chỗ là một lần SAI: giữ nguyên chỗ (thành lần sai trong cửa sổ).
     *
     * @return {@code true} khi lần sai này làm một ngân sách CHẠM trần (để ghi vết khoá đúng một lần)
     */
    public boolean commitMfaFailure(MfaAttempt attempt) {
        if (attempt == null || !attempt.settled.compareAndSet(false, true)) {
            return false;
        }
        return attempt.reachesLimit();
    }

    /** Trả chỗ của một lượt KHÔNG phải lần sai (mã đúng, mã vừa dùng, request hỏng). No-op khi lượt đã kết thúc. */
    public void refundMfaAttempt(MfaAttempt attempt) {
        if (attempt == null || !attempt.settled.compareAndSet(false, true)) {
            return;
        }
        for (MfaSlot slot : attempt.slots) {
            releaseMfaSlot(slot);
        }
    }

    /** Giữ một chỗ trong khoá {@code key}; {@code null} khi khoá đã có {@code max} lượt trong cửa sổ. */
    private MfaSlot reserveMfaSlot(String key, String tag, long userId, String ip, int max, long windowSeconds) {
        if (redis != null) {
            try {
                long now = System.currentTimeMillis();
                String member = now + "-" + nonce.incrementAndGet() + tag;
                Long count = redis.execute(reserveScript, List.of("rl:" + key),
                        Long.toString(now), Long.toString(windowSeconds * 1000L), Integer.toString(max), member);
                redisDownWarned = false;
                if (count == null || count <= 0L) {
                    return null;
                }
                return new MfaSlot(key, true, member, null, count);
            } catch (Exception e) {
                warnRedisDown(e);
            }
        }
        Instant now = Instant.now();
        Deque<MfaMark> deque = mfaFailureAttempts.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (deque) {
            pruneMfa(deque, now.minusSeconds(windowSeconds));
            if (deque.size() >= max) {
                return null;
            }
            MfaMark mark = new MfaMark(now, userId, ip);
            deque.addLast(mark);
            return new MfaSlot(key, false, null, mark, deque.size());
        }
    }

    private void releaseMfaSlot(MfaSlot slot) {
        if (slot.redis()) {
            try {
                redis.opsForZSet().remove("rl:" + slot.key(), slot.member());
            } catch (Exception e) {
                // Không trả được chỗ: lượt này bị tính như một lần sai tới hết cửa sổ — nghiêng về an toàn.
                log.warn("[RateLimiter] Không trả được chỗ 2FA trên Redis ({}): {}", slot.key(), e.getMessage());
            }
            return;
        }
        Deque<MfaMark> deque = mfaFailureAttempts.get(slot.key());
        if (deque == null) {
            return;
        }
        synchronized (deque) {
            Iterator<MfaMark> it = deque.iterator();
            while (it.hasNext()) {
                if (it.next() == slot.mark()) {
                    it.remove();
                    return;
                }
            }
        }
    }

    /** Trần cửa sổ — dùng khi không biết người/IP (giá trị lớn nhất có thể phải chờ). */
    public int mfaRetryAfterSeconds() { return (int) Math.max(1L, mfaFailureWindow); }

    /**
     * Số giây tới khi cả hai ngân sách (người dùng + IP) có lại ít nhất một chỗ — theo cửa sổ TRƯỢT: lượt cũ nhất
     * rời cửa sổ là mở được một lượt mới, không phải luôn đủ 15 phút. Chỉ ĐỌC. Tối thiểu 1, tối đa trần cửa sổ.
     */
    public int mfaRetryAfterSeconds(long userId, String ip) {
        long window = Math.max(1L, mfaFailureWindow);
        int max = Math.max(1, mfaFailureMax);
        long waitMs = Math.max(mfaWaitMs(mfaUserKey(userId), max, window), mfaWaitMs(mfaIpKey(ip), max, window));
        long seconds = (waitMs + 999L) / 1000L;
        // Trên một phút thì làm tròn LÊN phút: đủ cho người dùng, không lộ mốc chính xác tới từng giây.
        if (seconds > 60L) {
            seconds = ((seconds + 59L) / 60L) * 60L;
        }
        return (int) Math.min(window, Math.max(1L, seconds));
    }

    /** Mili-giây tới khi khoá {@code key} có lại một chỗ; 0 khi còn chỗ. */
    private long mfaWaitMs(String key, int max, long windowSeconds) {
        long windowMs = windowSeconds * 1000L;
        if (redis != null) {
            try {
                Long wait = redis.execute(waitScript, List.of("rl:" + key),
                        Long.toString(System.currentTimeMillis()), Long.toString(windowMs), Integer.toString(max));
                redisDownWarned = false;
                return wait == null ? 0L : Math.max(0L, wait);
            } catch (Exception e) {
                warnRedisDown(e);
            }
        }
        Deque<MfaMark> deque = mfaFailureAttempts.get(key);
        if (deque == null) {
            return 0L;
        }
        Instant now = Instant.now();
        synchronized (deque) {
            pruneMfa(deque, now.minusSeconds(windowSeconds));
            if (deque.size() < max) {
                return 0L;
            }
            // Phần tử thứ (size − max) tính từ cũ nhất phải rời cửa sổ thì còn đúng max − 1 lượt.
            int index = deque.size() - max;
            Iterator<MfaMark> it = deque.iterator();
            MfaMark mark = it.next();
            for (int i = 0; i < index; i++) {
                mark = it.next();
            }
            return Math.max(0L, mark.at.plusMillis(windowMs).toEpochMilli() - now.toEpochMilli());
        }
    }

    /** Số lượt 2FA (lần sai + lượt đang kiểm dở) của một người trong cửa sổ hiện tại. Chỉ ĐỌC. */
    public long mfaFailuresInWindow(long userId) {
        return countMfaInWindow(mfaUserKey(userId), Math.max(1L, mfaFailureWindow));
    }

    private static final int MFA_IPS_MAX = 10;

    /** Các IP (khác nhau, tối đa 10) đã gây lần sai 2FA của một người trong cửa sổ. Chỉ ĐỌC — để ghi vết. */
    public List<String> mfaFailureIpsInWindow(long userId) {
        String userKey = mfaUserKey(userId);
        long window = Math.max(1L, mfaFailureWindow);
        Set<String> ips = new LinkedHashSet<>();
        if (redis != null) {
            try {
                long now = System.currentTimeMillis();
                Set<String> members = redis.opsForZSet().rangeByScore("rl:" + userKey, now - window * 1000L, now);
                if (members != null) {
                    for (String m : members) {
                        int bar = m.indexOf('|');
                        if (bar >= 0) {
                            ips.add(m.substring(bar + 1));
                        }
                    }
                }
                redisDownWarned = false;
            } catch (Exception e) {
                warnRedisDown(e);
            }
        }
        Deque<MfaMark> deque = mfaFailureAttempts.get(userKey);
        if (deque != null) {
            synchronized (deque) {
                pruneMfa(deque, Instant.now().minusSeconds(window));
                for (MfaMark mark : deque) {
                    ips.add(mark.ip);
                }
            }
        }
        return ips.stream().limit(MFA_IPS_MAX).toList();
    }

    /**
     * ADMIN gỡ khoá nhập sai 2FA của một người: xoá mọi lần sai của người đó trong ngân sách theo người dùng VÀ phần
     * lần sai CỦA NGƯỜI ĐÓ trong ngân sách của các IP họ đã nhập (lần sai của người khác cùng IP vẫn tính). Không
     * đụng tới bí mật TOTP. Không nguyên tử: mọi lượt của người đó đã giữ chỗ TỚI lúc gỡ (kể cả lượt đang kiểm dở) bị
     * xoá theo — tương đương "gỡ khoá xoá mọi thứ tới lúc đó", không cho thêm lượt nào ngoài việc gỡ. Redis hỏng và có
     * nhiều node thì chỉ xoá được bộ nhớ của node nhận request.
     *
     * @return số lần sai (kể cả lượt đang kiểm dở) đã xoá khỏi ngân sách theo người dùng
     */
    public int clearMfaFailuresForUser(long userId) {
        String userKey = mfaUserKey(userId);
        String userTag = "|u" + userId;
        int cleared = 0;
        if (redis != null) {
            try {
                Set<String> members = redis.opsForZSet().range("rl:" + userKey, 0, -1);
                Set<String> ips = new LinkedHashSet<>();
                if (members != null) {
                    cleared = members.size();
                    for (String m : members) {
                        int bar = m.indexOf('|');
                        if (bar >= 0) {
                            ips.add(m.substring(bar + 1));
                        }
                    }
                }
                redis.delete("rl:" + userKey);
                for (String ip : ips) {
                    String ipKey = "rl:" + mfaIpKey(ip);
                    Set<String> ipMembers = redis.opsForZSet().range(ipKey, 0, -1);
                    if (ipMembers == null) {
                        continue;
                    }
                    Object[] mine = ipMembers.stream().filter(m -> m.endsWith(userTag)).toArray();
                    if (mine.length > 0) {
                        redis.opsForZSet().remove(ipKey, mine);
                    }
                }
                redisDownWarned = false;
            } catch (Exception e) {
                warnRedisDown(e);
            }
        }
        // Bộ nhớ của node (dữ liệu từ lúc Redis hỏng, hoặc khi không có Redis).
        Deque<MfaMark> userDeque = mfaFailureAttempts.remove(userKey);
        Set<String> ips = new LinkedHashSet<>();
        if (userDeque != null) {
            synchronized (userDeque) {
                cleared += userDeque.size();
                for (MfaMark mark : userDeque) {
                    ips.add(mark.ip);
                }
            }
        }
        for (String ip : ips) {
            Deque<MfaMark> ipDeque = mfaFailureAttempts.get(mfaIpKey(ip));
            if (ipDeque == null) {
                continue;
            }
            synchronized (ipDeque) {
                ipDeque.removeIf(mark -> mark.userId == userId);
            }
        }
        return cleared;
    }

    private long countMfaInWindow(String key, long windowSeconds) {
        if (redis != null) {
            try {
                long now = System.currentTimeMillis();
                Long count = redis.execute(countScript, List.of("rl:" + key),
                        Long.toString(now), Long.toString(windowSeconds * 1000L));
                redisDownWarned = false;
                return count == null ? 0L : count;
            } catch (Exception e) {
                warnRedisDown(e);
            }
        }
        Deque<MfaMark> deque = mfaFailureAttempts.get(key);
        if (deque == null) {
            return 0L;
        }
        synchronized (deque) {
            pruneMfa(deque, Instant.now().minusSeconds(windowSeconds));
            return deque.size();
        }
    }

    private static void pruneMfa(Deque<MfaMark> deque, Instant windowStart) {
        while (!deque.isEmpty() && deque.peekFirst().at.isBefore(windowStart)) {
            deque.pollFirst();
        }
    }

    private void warnRedisDown(Exception e) {
        if (!redisDownWarned) {
            redisDownWarned = true;
            log.warn("[RateLimiter] Redis unavailable — falling back to in-memory per-node limiting: {}", e.getMessage());
        }
    }

    /** Trần gửi mã email đăng ký 2FA theo người dùng. */
    public boolean allowMfaEmailSend(long userId) {
        return check(mfaEmailSendAttempts, "mfa-email|" + userId,
                Math.max(1, mfaEmailSendMax), Math.max(1L, mfaEmailSendWindow));
    }

    public int mfaEmailSendRetryAfterSeconds() { return (int) Math.max(1L, mfaEmailSendWindow); }

    private static String mfaUserKey(long userId) { return "mfa-fail-user|" + userId; }
    private static String mfaIpKey(String ip)     { return "mfa-fail-ip|" + safe(ip); }

    public int guestSessionCreateRetryAfterSeconds()   { return (int) guestSessionCreateWindow; }
    public int registrationSendRetryAfterSeconds()     { return (int) registrationSendWindow; }
    public int registrationVerifyIpRetryAfterSeconds() { return (int) registrationVerifyIpWindow; }

    private static String sha256Hex(String s) {
        try {
            byte[] d = java.security.MessageDigest.getInstance("SHA-256")
                    .digest(s.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(d);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    // ─── Retry-After helpers (used in RateLimitExceededException) ──────────────

    public int retryAfterSeconds()         { return (int) loginWindow;    }
    public int loginIpRetryAfterSeconds()  { return (int) loginIpWindow;  }
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
