package com.deutschflow.user.onboarding.lifecycle;

import com.deutschflow.notification.NotificationType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Lifecycle tuần đầu + trial (Đợt 6 kế hoạch onboarding 17/09/2026 §4.7). Tham số hoá theo MỐC,
 * không hard-code "ngày 7":
 *
 * <pre>
 *  D0  activated_at vừa ghi (≤ 26 h)              → chúc mừng + mời đặt giờ nhắc   (bất kỳ giờ)
 *  D1  24–48 h sau activation, chưa học lại       → "bài tiếp theo 5 phút"          (đúng giờ nhắc)
 *  D3  72–96 h sau activation                     → chuỗi ngày / "quay lại 5 phút"  (đúng giờ nhắc)
 *  D7  7–8 ngày sau activation                    → tổng kết tuần đầu               (đúng giờ nhắc)
 *  T3  trial ACTIVE, ends_at trong ≤ 3 ngày       → "PRO miễn phí tới {ngày}"       (đúng giờ nhắc)
 *  T0  trial ENDED trong 24 h qua                 → "đã về gói mặc định"            (bất kỳ giờ)
 * </pre>
 *
 * "Giờ nhắc" = {@code users.reminder_hour_local} theo {@code notification_timezone}; chưa chọn thì
 * {@value #DEFAULT_HOUR} h — cùng giờ {@code DailyNotificationJob} nhắc chuỗi, và job đó BỎ nhắc chuỗi
 * ngày nào đã có tin lifecycle (sổ {@code lifecycle_sends}, xem {@link #hasSendOnLocalDay}).
 * Mỗi tin gửi đúng một lần qua {@link OnboardingLifecycleSender#sendOnce}. Job chạy mỗi giờ nên
 * cửa sổ giờ so bằng {@code ==}; tin trễ ≤ 1 h so với mốc là chấp nhận được (§4.7).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OnboardingLifecycleService {

    static final int DEFAULT_HOUR = 18;
    static final ZoneId DEFAULT_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DAY_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final JdbcTemplate jdbc;
    private final OnboardingLifecycleSender sender;

    public record Result(int candidates, int sent) {}

    /** Điểm vào của job: quét hai nguồn (activation, trial) và gửi những gì tới mốc. */
    public Result runHourly(Instant now) {
        int candidates = 0;
        int sent = 0;
        List<Map<String, Object>> activated = jdbc.queryForList("""
                SELECT p.user_id, p.activated_at, u.notification_timezone, u.reminder_hour_local
                FROM user_onboarding_progress p
                JOIN users u ON u.id = p.user_id
                WHERE p.activated_at IS NOT NULL
                  AND p.activated_at >= ?
                  AND u.is_active = TRUE AND u.role = 'STUDENT'
                ORDER BY p.user_id
                """, Timestamp.from(now.minus(Duration.ofDays(8).plusHours(2))));
        for (Map<String, Object> row : activated) {
            candidates++;
            long userId = ((Number) row.get("user_id")).longValue();
            try {
                sent += processActivation(userId, toInstant(row.get("activated_at")),
                        zoneOf(row.get("notification_timezone")), hourOf(row.get("reminder_hour_local")), now);
            } catch (Exception e) {
                log.warn("[LIFECYCLE] userId={} activation: {}", userId, e.toString());
            }
        }

        // user_subscriptions.ends_at là TIMESTAMPTZ (V199) — bind Timestamp.from(Instant) như QuotaService; index
        // idx_user_subscriptions_trial_ends (V333) phủ (source, status, ends_at) cho câu quét không có user_id này.
        List<Map<String, Object>> trials = jdbc.queryForList("""
                SELECT us.user_id, us.status, us.ends_at, u.notification_timezone, u.reminder_hour_local
                FROM user_subscriptions us
                JOIN users u ON u.id = us.user_id
                WHERE us.source = 'TRIAL' AND us.ends_at IS NOT NULL
                  AND u.is_active = TRUE AND u.role = 'STUDENT'
                  AND ((us.status = 'ACTIVE' AND us.ends_at > ? AND us.ends_at <= ?)
                    OR (us.status = 'ENDED' AND us.ends_at > ? AND us.ends_at <= ?))
                ORDER BY us.user_id
                """,
                Timestamp.from(now), Timestamp.from(now.plus(Duration.ofDays(3))),
                Timestamp.from(now.minus(Duration.ofHours(24))), Timestamp.from(now));
        for (Map<String, Object> row : trials) {
            candidates++;
            long userId = ((Number) row.get("user_id")).longValue();
            try {
                sent += processTrial(userId, (String) row.get("status"), toInstant(row.get("ends_at")),
                        zoneOf(row.get("notification_timezone")), hourOf(row.get("reminder_hour_local")), now);
            } catch (Exception e) {
                log.warn("[LIFECYCLE] userId={} trial: {}", userId, e.toString());
            }
        }
        if (sent > 0) log.info("[LIFECYCLE] quét {} ứng viên, gửi {} tin", candidates, sent);
        return new Result(candidates, sent);
    }

    int processActivation(long userId, Instant activatedAt, ZoneId zone, int reminderHour, Instant now) {
        long ageHours = Duration.between(activatedAt, now).toHours();
        boolean atReminderHour = ZonedDateTime.ofInstant(now, zone).getHour() == reminderHour;
        int sent = 0;
        if (ageHours <= 26) {
            sent += send(userId, "D0", NotificationType.ONBOARDING_D0_WELCOME,
                    msg("Bài đầu tiên đã xong. Đặt giờ nhắc để giữ nhịp mỗi ngày — chỉ một thông báo mỗi tối."));
        }
        if (!atReminderHour) return sent;
        if (ageHours >= 24 && ageHours < 48 && !hasActivitySince(userId, activatedAt)) {
            sent += send(userId, "D1", NotificationType.ONBOARDING_D1_NEXT_LESSON,
                    msg("Hôm qua bạn đã học bài đầu tiên. Hôm nay một bài 5 phút là đủ để giữ đà."));
        }
        if (ageHours >= 72 && ageHours < 96) {
            int activeDays = activeDaysSince(userId, activatedAt, zone);
            Map<String, Object> p = msg(activeDays >= 2
                    ? "Bạn đã có " + activeDays + " ngày học kể từ bài đầu — chuỗi đang lên. Tiếp tục nào!"
                    : "Quay lại 5 phút hôm nay là chuỗi vẫn còn. Lộ trình đang chờ bạn ở trang chủ.");
            p.put("activeDays", activeDays);
            sent += send(userId, "D3", NotificationType.ONBOARDING_D3_CHECKIN, p);
        }
        if (ageHours >= 168 && ageHours < 192) {
            int activeDays = activeDaysSince(userId, activatedAt, zone);
            Map<String, Object> p = msg("Tuần đầu của bạn: " + activeDays + "/7 ngày có học. "
                    + "Checklist tuần đầu đã xong việc — từ giờ lộ trình dẫn đường.");
            p.put("activeDays", activeDays);
            sent += send(userId, "D7", NotificationType.ONBOARDING_D7_SUMMARY, p);
        }
        return sent;
    }

    int processTrial(long userId, String status, Instant endsAt, ZoneId zone, int reminderHour, Instant now) {
        String endsDay = ZonedDateTime.ofInstant(endsAt, zone).format(DAY_FMT);
        if ("ENDED".equals(status)) {
            Map<String, Object> p = msg("Thời gian dùng thử đã kết thúc, tài khoản về gói mặc định. "
                    + "Bài đã học và lộ trình vẫn giữ nguyên — nâng cấp khi bạn sẵn sàng.");
            p.put("trialEndsAt", endsAt.toString());
            return send(userId, "T0", NotificationType.TRIAL_ENDED, p);
        }
        if (ZonedDateTime.ofInstant(now, zone).getHour() != reminderHour) return 0;
        Map<String, Object> p = msg("PRO miễn phí của bạn còn tới " + endsDay
                + ". Sau đó tài khoản về gói mặc định; bài đã học vẫn giữ nguyên.");
        p.put("trialEndsAt", endsAt.toString());
        p.put("endsDay", endsDay);
        return send(userId, "T3", NotificationType.TRIAL_ENDING_SOON, p);
    }

    /** Ngày (theo múi giờ người dùng) đã có tin lifecycle chưa — {@code DailyNotificationJob} hỏi để bỏ nhắc chuỗi. */
    public boolean hasSendOnLocalDay(long userId, ZoneId zone, Instant now) {
        Instant dayStart = ZonedDateTime.ofInstant(now, zone).toLocalDate().atStartOfDay(zone).toInstant();
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM lifecycle_sends WHERE user_id = ? AND sent_at >= ?",
                Integer.class, userId, Timestamp.from(dayStart));
        return n != null && n > 0;
    }

    private int send(long userId, String key, NotificationType type, Map<String, Object> payload) {
        return sender.sendOnce(userId, key, type, payload) ? 1 : 0;
    }

    private boolean hasActivitySince(long userId, Instant since) {
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM user_xp_events WHERE user_id = ? AND created_at > ?",
                Integer.class, userId, Timestamp.from(since));
        return n != null && n > 0;
    }

    /** Số ngày (theo múi giờ người dùng) có sự kiện XP kể từ activation. */
    private int activeDaysSince(long userId, Instant since, ZoneId zone) {
        Integer n = jdbc.queryForObject("""
                SELECT COUNT(DISTINCT (created_at AT TIME ZONE ?)::date)
                FROM user_xp_events WHERE user_id = ? AND created_at >= ?
                """, Integer.class, zone.getId(), userId, Timestamp.from(since));
        return n == null ? 0 : n;
    }

    static Map<String, Object> msg(String message) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("message", message);
        return p;
    }

    static ZoneId zoneOf(Object raw) {
        if (raw instanceof String s && !s.isBlank()) {
            try {
                return ZoneId.of(s);
            } catch (Exception ignored) { /* rơi về mặc định */ }
        }
        return DEFAULT_ZONE;
    }

    static int hourOf(Object raw) {
        if (raw instanceof Number n) {
            int h = n.intValue();
            if (h >= 0 && h <= 23) return h;
        }
        return DEFAULT_HOUR;
    }

    static Instant toInstant(Object raw) {
        if (raw instanceof Timestamp ts) return ts.toInstant();
        if (raw instanceof java.time.OffsetDateTime odt) return odt.toInstant();
        if (raw instanceof Instant i) return i;
        throw new IllegalArgumentException("Không đọc được thời điểm: " + raw);
    }
}
