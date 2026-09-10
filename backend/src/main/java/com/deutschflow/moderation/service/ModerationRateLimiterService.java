package com.deutschflow.moderation.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Throttle theo NGƯỜI cho {@code POST /api/moderation/report} (B2, owner chốt 10/09/2026):
 * <b>10 báo cáo / giờ</b> và <b>30 báo cáo / ngày</b>, hai cửa sổ trượt kiểm đồng thời.
 *
 * <p><b>Vì sao có lớp này.</b> Trước 10/09 đường report không bị throttle ở tầng nào:
 * {@code PublicApiRateLimitFilter} chỉ phủ {@code /api/public/**} và vài đường permitAll, còn
 * {@code /api/moderation/**} là đường có đăng nhập nên rơi ngoài. Một tài khoản có thể nộp hàng
 * nghìn báo cáo trong vài phút — mỗi báo cáo CHÉP nội dung tin nhắn vào {@code snapshot_body}, nên
 * đây vừa là DoS lên hàng đợi kiểm duyệt vừa là máy nhân bản nội dung người khác.
 *
 * <p><b>Vì sao không dùng {@code AiRateLimiterService}.</b> Cùng cơ chế (Redis sorted-set + Lua,
 * fallback in-memory theo khuôn {@code NotificationRateLimiterService}) nhưng cố ý KHÔNG trộn vào
 * enum {@code Bucket} và cấu hình {@code app.ai.*}: throttle kiểm duyệt không phải chi phí AI, và
 * người vận hành chỉnh ngưỡng AI không được vô tình chỉnh ngưỡng báo cáo. Cấu hình riêng ở
 * {@code app.moderation.report.rate-limit.*}.
 *
 * <p><b>Hai cửa sổ trong MỘT script.</b> Kiểm rồi mới ghi, ghi vào cả hai cùng lúc: kiểm tuần tự
 * bằng hai script (giờ trước, ngày sau) sẽ ghi một lượt vào cửa sổ giờ ngay cả khi cửa sổ ngày từ
 * chối — người dùng bị "đốt" slot mà không nộp được gì. Script trả bitmask cửa sổ nào đầy để
 * {@code Retry-After} tính theo đúng cửa sổ đó (slot kế tiếp mở khi lượt CŨ NHẤT rời cửa sổ, cùng
 * lý do R-B6 của {@code AiRateLimiterService#retryAfterSeconds}).
 *
 * <p><b>Vé và trả lượt (review 10/09).</b> Mỗi lượt cho qua mang một {@code ticket} — chính là member
 * trong zset Redis, và là khoá của lượt trong bộ nhớ. {@link ContentReportService} trả vé lại qua
 * {@link #refund} khi lượt ấy rốt cuộc không tạo báo cáo mới (thua cuộc đua với chính mình trên unique
 * partial V321): theo luật khử trùng B2, lần trùng không "mua" slot nào.
 *
 * <p>Redis chết ⇒ rơi về in-memory theo node (cảnh báo một lần). Throttle là lớp chống lạm dụng,
 * không phải lớp bảo mật — không được làm chết đường báo cáo khi hạ tầng phụ trợ chết.
 */
@Slf4j
@Service
public class ModerationRateLimiterService {

    /**
     * Kết quả một lần hỏi: cho qua, hay chặn và nên thử lại sau bao nhiêu giây. {@code ticket} là VÉ
     * của lượt vừa cấp — chỉ có khi cho qua và throttle đang bật; đưa lại cho {@link #refund}.
     */
    public record Decision(boolean allowed, int retryAfterSeconds, @Nullable String ticket) {
        private static final Decision ALLOWED_WITHOUT_TICKET = new Decision(true, 0, null);

        /** Cho qua KHÔNG có vé (throttle tắt, hoặc test): {@link #refund} với nó là no-op. */
        public static Decision allow() {
            return ALLOWED_WITHOUT_TICKET;
        }

        static Decision allow(String ticket) {
            return new Decision(true, 0, ticket);
        }

        public static Decision blocked(int retryAfterSeconds) {
            return new Decision(false, Math.max(1, retryAfterSeconds), null);
        }
    }

    private static final int HOUR_FULL = 1;
    private static final int DAY_FULL = 2;

    /**
     * KEYS[1] = zset cửa sổ giờ, KEYS[2] = zset cửa sổ ngày.
     * ARGV[1] = now(ms), ARGV[2] = hourWindow(ms), ARGV[3] = hourMax, ARGV[4] = dayWindow(ms),
     * ARGV[5] = dayMax, ARGV[6] = member duy nhất (= vé của lượt).
     * Trả 0 khi cho qua (đã ghi vào CẢ HAI), ngược lại bitmask 1 = giờ đầy, 2 = ngày đầy.
     */
    private static final String TWO_WINDOW_LUA = """
            local now = tonumber(ARGV[1])
            redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - tonumber(ARGV[2]))
            redis.call('ZREMRANGEBYSCORE', KEYS[2], 0, now - tonumber(ARGV[4]))
            local blocked = 0
            if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[3]) then blocked = blocked + 1 end
            if redis.call('ZCARD', KEYS[2]) >= tonumber(ARGV[5]) then blocked = blocked + 2 end
            if blocked ~= 0 then return blocked end
            redis.call('ZADD', KEYS[1], now, ARGV[6])
            redis.call('PEXPIRE', KEYS[1], ARGV[2])
            redis.call('ZADD', KEYS[2], now, ARGV[6])
            redis.call('PEXPIRE', KEYS[2], ARGV[4])
            return 0
            """;

    private final boolean enabled;
    private final int hourMax;
    private final long hourWindowSeconds;
    private final int dayMax;
    private final long dayWindowSeconds;

    private final StringRedisTemplate redis;
    private final DefaultRedisScript<Long> twoWindowScript;
    private final AtomicLong nonce = new AtomicLong();
    private volatile boolean redisDownWarned = false;

    /** Fallback theo node: hai deque lượt cho mỗi người, khoá theo người. */
    private final ConcurrentHashMap<Long, Windows> memory = new ConcurrentHashMap<>();

    /** Một lượt đã cấp trong bộ nhớ: mốc ms để trượt cửa sổ + vé để {@link #refund} trả đúng lượt. */
    private record Slot(long at, String ticket) {}

    private static final class Windows {
        final Deque<Slot> hour = new ArrayDeque<>();
        final Deque<Slot> day = new ArrayDeque<>();
    }

    public ModerationRateLimiterService(
            @Value("${app.moderation.report.rate-limit.enabled:true}") boolean enabled,
            @Value("${app.moderation.report.rate-limit.hour-max:10}") int hourMax,
            @Value("${app.moderation.report.rate-limit.hour-window-seconds:3600}") long hourWindowSeconds,
            @Value("${app.moderation.report.rate-limit.day-max:30}") int dayMax,
            @Value("${app.moderation.report.rate-limit.day-window-seconds:86400}") long dayWindowSeconds,
            @Nullable StringRedisTemplate redis) {
        this.enabled = enabled;
        this.hourMax = Math.max(1, hourMax);
        this.hourWindowSeconds = Math.max(1L, hourWindowSeconds);
        this.dayMax = Math.max(1, dayMax);
        this.dayWindowSeconds = Math.max(1L, dayWindowSeconds);
        this.redis = redis;
        this.twoWindowScript = new DefaultRedisScript<>(TWO_WINDOW_LUA, Long.class);
        log.info("[ModerationRateLimiter] {} · {}/{}s + {}/{}s · storage={}",
                enabled ? "BẬT" : "TẮT", this.hourMax, this.hourWindowSeconds, this.dayMax, this.dayWindowSeconds,
                this.redis != null ? "Redis + in-memory fallback" : "in-memory only");
    }

    /** Người này được nộp thêm một báo cáo lúc này không? Ghi nhận lượt (kèm vé) khi cho qua. */
    public Decision decide(long userId) {
        if (!enabled) {
            return Decision.allow();
        }
        long now = System.currentTimeMillis();
        // Vé duy nhất theo node: là member trong zset Redis, và là khoá trả lượt ở cả hai kho.
        String ticket = now + "-" + nonce.incrementAndGet();
        if (redis != null) {
            try {
                Long blocked = redis.execute(
                        twoWindowScript,
                        List.of(hourKey(userId), dayKey(userId)),
                        Long.toString(now),
                        Long.toString(hourWindowSeconds * 1000L),
                        Integer.toString(hourMax),
                        Long.toString(dayWindowSeconds * 1000L),
                        Integer.toString(dayMax),
                        ticket);
                redisDownWarned = false;
                int mask = blocked == null ? 0 : blocked.intValue();
                return mask == 0 ? Decision.allow(ticket) : Decision.blocked(retryAfterFromRedis(userId, mask, now));
            } catch (Exception e) {
                if (!redisDownWarned) {
                    redisDownWarned = true;
                    log.warn("[ModerationRateLimiter] Redis unavailable — falling back to in-memory per-node limiting: {}",
                            e.getMessage());
                }
                // rơi về in-memory
            }
        }
        return decideInMemory(userId, now, ticket);
    }

    /**
     * Trả lại lượt vừa cấp bởi {@link #decide} khi lượt ấy rốt cuộc KHÔNG tạo báo cáo mới — ca đua hai
     * POST đồng thời cùng khoá (review 10/09): unique partial V321 chặn dòng thứ hai, người dùng nhận
     * id cũ, và theo luật khử trùng B2 lần trùng không "mua" slot nào (bấm hai lần vì mạng chậm không
     * phải lạm dụng).
     *
     * <p>No-op với quyết định chặn hay quyết định không mang vé ({@link Decision#allow()}). Thử cả hai
     * kho — ZREM trên Redis và xoá theo vé trong bộ nhớ: kho nào không có vé thì không đổi gì, nên gọi
     * lại nhiều lần cũng chỉ trả đúng một lượt. Redis chết lúc trả ⇒ bỏ qua: lượt trên Redis tự rời
     * cửa sổ theo thời gian; đây là lớp chống lạm dụng, một slot lệch không đáng làm đổ đường báo cáo.
     */
    public void refund(long userId, @Nullable Decision decision) {
        if (!enabled || decision == null || !decision.allowed() || decision.ticket() == null) {
            return;
        }
        String ticket = decision.ticket();
        if (redis != null) {
            try {
                redis.opsForZSet().remove(hourKey(userId), ticket);
                redis.opsForZSet().remove(dayKey(userId), ticket);
            } catch (Exception e) {
                log.debug("[ModerationRateLimiter] Redis unavailable while refunding a slot for user {}: {}",
                        userId, e.getMessage());
            }
        }
        Windows w = memory.get(userId);
        if (w != null) {
            synchronized (w) {
                w.hour.removeIf(s -> s.ticket().equals(ticket));
                w.day.removeIf(s -> s.ticket().equals(ticket));
            }
        }
    }

    // ─── Retry-After: slot kế tiếp mở khi lượt CŨ NHẤT còn trong cửa sổ rời đi ─────────────────

    private int retryAfterFromRedis(long userId, int mask, long now) {
        int retry = 0;
        if ((mask & HOUR_FULL) != 0) {
            retry = Math.max(retry, secondsUntilOldestLeaves(oldestScore(hourKey(userId)), hourWindowSeconds, now));
        }
        if ((mask & DAY_FULL) != 0) {
            retry = Math.max(retry, secondsUntilOldestLeaves(oldestScore(dayKey(userId)), dayWindowSeconds, now));
        }
        return retry;
    }

    private Long oldestScore(String key) {
        try {
            var oldest = redis.opsForZSet().rangeWithScores(key, 0, 0);
            if (oldest != null && !oldest.isEmpty()) {
                Double score = oldest.iterator().next().getScore();
                return score != null ? score.longValue() : null;
            }
        } catch (Exception e) {
            // không đọc được ⇒ trả 1s ở dưới; client thử lại và nhận câu trả lời đúng lần sau
        }
        return null;
    }

    /** {@code oldest + window - now}, làm tròn lên, kẹp trong [1, window]. Không có mốc ⇒ 1s. */
    private static int secondsUntilOldestLeaves(Long oldestMs, long windowSeconds, long nowMs) {
        if (oldestMs == null) {
            return 1;
        }
        long remainMs = windowSeconds * 1000L - (nowMs - oldestMs);
        if (remainMs <= 1000L) {
            return 1;
        }
        return (int) Math.min(windowSeconds, (remainMs + 999L) / 1000L);
    }

    // ─── In-memory fallback ────────────────────────────────────────────────────────────────────

    private Decision decideInMemory(long userId, long now, String ticket) {
        Windows w = memory.computeIfAbsent(userId, k -> new Windows());
        synchronized (w) {
            evict(w.hour, now - hourWindowSeconds * 1000L);
            evict(w.day, now - dayWindowSeconds * 1000L);
            int retry = 0;
            if (w.hour.size() >= hourMax) {
                retry = Math.max(retry, secondsUntilOldestLeaves(oldestAt(w.hour), hourWindowSeconds, now));
            }
            if (w.day.size() >= dayMax) {
                retry = Math.max(retry, secondsUntilOldestLeaves(oldestAt(w.day), dayWindowSeconds, now));
            }
            if (retry > 0) {
                return Decision.blocked(retry);
            }
            Slot slot = new Slot(now, ticket);
            w.hour.addLast(slot);
            w.day.addLast(slot);
            return Decision.allow(ticket);
        }
    }

    private static Long oldestAt(Deque<Slot> deque) {
        Slot oldest = deque.peekFirst();
        return oldest == null ? null : oldest.at();
    }

    private static void evict(Deque<Slot> deque, long clearBeforeExclusive) {
        while (!deque.isEmpty() && deque.peekFirst().at() <= clearBeforeExclusive) {
            deque.pollFirst();
        }
    }

    private static String hourKey(long userId) {
        return "rl:moderation:report:h|" + userId;
    }

    private static String dayKey(long userId) {
        return "rl:moderation:report:d|" + userId;
    }
}
