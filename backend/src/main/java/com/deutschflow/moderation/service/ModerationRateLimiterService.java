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
 * <p>Redis chết ⇒ rơi về in-memory theo node (cảnh báo một lần). Throttle là lớp chống lạm dụng,
 * không phải lớp bảo mật — không được làm chết đường báo cáo khi hạ tầng phụ trợ chết.
 */
@Slf4j
@Service
public class ModerationRateLimiterService {

    /** Kết quả một lần hỏi: cho qua, hay chặn và nên thử lại sau bao nhiêu giây. */
    public record Decision(boolean allowed, int retryAfterSeconds) {
        private static final Decision ALLOWED = new Decision(true, 0);

        public static Decision allow() {
            return ALLOWED;
        }

        public static Decision blocked(int retryAfterSeconds) {
            return new Decision(false, Math.max(1, retryAfterSeconds));
        }
    }

    private static final int HOUR_FULL = 1;
    private static final int DAY_FULL = 2;

    /**
     * KEYS[1] = zset cửa sổ giờ, KEYS[2] = zset cửa sổ ngày.
     * ARGV[1] = now(ms), ARGV[2] = hourWindow(ms), ARGV[3] = hourMax, ARGV[4] = dayWindow(ms),
     * ARGV[5] = dayMax, ARGV[6] = member duy nhất.
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

    /** Fallback theo node: hai deque mốc ms cho mỗi người, khoá theo người. */
    private final ConcurrentHashMap<Long, Windows> memory = new ConcurrentHashMap<>();

    private static final class Windows {
        final Deque<Long> hour = new ArrayDeque<>();
        final Deque<Long> day = new ArrayDeque<>();
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

    /** Người này được nộp thêm một báo cáo lúc này không? Ghi nhận lượt khi cho qua. */
    public Decision decide(long userId) {
        if (!enabled) {
            return Decision.allow();
        }
        long now = System.currentTimeMillis();
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
                        now + "-" + nonce.incrementAndGet());
                redisDownWarned = false;
                int mask = blocked == null ? 0 : blocked.intValue();
                return mask == 0 ? Decision.allow() : Decision.blocked(retryAfterFromRedis(userId, mask, now));
            } catch (Exception e) {
                if (!redisDownWarned) {
                    redisDownWarned = true;
                    log.warn("[ModerationRateLimiter] Redis unavailable — falling back to in-memory per-node limiting: {}",
                            e.getMessage());
                }
                // rơi về in-memory
            }
        }
        return decideInMemory(userId, now);
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

    private Decision decideInMemory(long userId, long now) {
        Windows w = memory.computeIfAbsent(userId, k -> new Windows());
        synchronized (w) {
            evict(w.hour, now - hourWindowSeconds * 1000L);
            evict(w.day, now - dayWindowSeconds * 1000L);
            int retry = 0;
            if (w.hour.size() >= hourMax) {
                retry = Math.max(retry, secondsUntilOldestLeaves(w.hour.peekFirst(), hourWindowSeconds, now));
            }
            if (w.day.size() >= dayMax) {
                retry = Math.max(retry, secondsUntilOldestLeaves(w.day.peekFirst(), dayWindowSeconds, now));
            }
            if (retry > 0) {
                return Decision.blocked(retry);
            }
            w.hour.addLast(now);
            w.day.addLast(now);
            return Decision.allow();
        }
    }

    private static void evict(Deque<Long> deque, long clearBeforeExclusive) {
        while (!deque.isEmpty() && deque.peekFirst() <= clearBeforeExclusive) {
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
