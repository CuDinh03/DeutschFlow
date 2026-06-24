package com.deutschflow.notification.jobs;

import com.deutschflow.notification.service.UserNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;

/**
 * Scheduled jobs for daily engagement notifications.
 * <ul>
 *   <li>Every hour: check if it's 8:00 AM in a user's timezone → send REVIEW_DUE if they have cards due.</li>
 *   <li>Every hour: check if it's 6:00 PM (18:00) in a user's timezone → send STREAK_REMINDER if they haven't studied.</li>
 * </ul>
 * Default timezone: Asia/Ho_Chi_Minh (user can override via notification_timezone column).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DailyNotificationJob {

    private final UserNotificationService userNotificationService;
    private final JdbcTemplate jdbcTemplate;

    private static final int REVIEW_DUE_HOUR = 8;
    private static final int STREAK_REMINDER_HOUR = 18;
    private static final int PAGE_SIZE = 500;

    /**
     * Runs every hour at minute 0. Checks which users are in the target hour
     * and sends them the appropriate notification.
     */
    @Scheduled(cron = "0 0 * * * *")
    @SchedulerLock(name = "dailyNotifications", lockAtMostFor = "PT10M", lockAtLeastFor = "PT1M")
    public void checkAndSendDailyNotifications() {
        log.debug("[DailyNotificationJob] Hourly check started");

        long offset = 0;
        while (true) {
            List<Map<String, Object>> page = jdbcTemplate.queryForList(
                    "SELECT id, notification_timezone FROM users WHERE role = 'STUDENT' AND is_active = TRUE ORDER BY id LIMIT ? OFFSET ?",
                    PAGE_SIZE, offset);
            if (page.isEmpty()) break;

            for (Map<String, Object> row : page) {
                long userId = ((Number) row.get("id")).longValue();
                String tzStr = (String) row.get("notification_timezone");
                try {
                    if (tzStr == null || tzStr.isBlank()) tzStr = "Asia/Ho_Chi_Minh";
                    ZoneId tz;
                    try {
                        tz = ZoneId.of(tzStr);
                    } catch (Exception e) {
                        tz = ZoneId.of("Asia/Ho_Chi_Minh");
                    }
                    int currentHour = ZonedDateTime.now(tz).getHour();
                    if (currentHour == REVIEW_DUE_HOUR) sendReviewDueIfNeeded(userId);
                    if (currentHour == STREAK_REMINDER_HOUR) sendStreakReminderIfNeeded(userId);
                } catch (Exception e) {
                    log.warn("[DailyNotificationJob] Error processing user {}: {}", userId, e.getMessage());
                }
            }

            if (page.size() < PAGE_SIZE) break;
            offset += PAGE_SIZE;
        }
    }

    private void sendReviewDueIfNeeded(long userId) {
        // Count due cards in the canonical FSRS SRS table (vocab_review_schedule, V110).
        // The previous query targeted "review_queue" — a table that has never existed in any
        // migration — so this whole branch was throwing every hour the job fired. vocab_review_schedule
        // exposes the same column names this code already used (user_id, next_review_at TIMESTAMPTZ),
        // and is fed by SrsVocabScheduler from every learning flow.
        Integer dueCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM vocab_review_schedule WHERE user_id = ? AND next_review_at <= NOW()",
                Integer.class, userId);

        if (dueCount != null && dueCount > 0) {
            // Check if we already sent a REVIEW_DUE today (avoid duplicates)
            Long alreadySent = jdbcTemplate.queryForObject(
                    """
                    SELECT COUNT(*) FROM user_notifications
                    WHERE recipient_user_id = ? AND notification_type = 'REVIEW_DUE'
                      AND created_at >= CURRENT_DATE
                    """, Long.class, userId);

            if (alreadySent == null || alreadySent == 0) {
                userNotificationService.onReviewDue(userId, dueCount);
                log.debug("[DailyNotificationJob] REVIEW_DUE sent to user {} — {} cards", userId, dueCount);
            }
        }
    }

    private void sendStreakReminderIfNeeded(long userId) {
        // Check if user has any activity today (XP events or session progress)
        Long activityToday = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM user_xp_events
                WHERE user_id = ? AND created_at >= CURRENT_DATE
                """, Long.class, userId);

        if (activityToday != null && activityToday > 0) {
            return; // User already studied today — no reminder needed
        }

        // Check if already sent today
        Long alreadySent = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM user_notifications
                WHERE recipient_user_id = ? AND notification_type = 'STREAK_REMINDER'
                  AND created_at >= CURRENT_DATE
                """, Long.class, userId);

        if (alreadySent != null && alreadySent > 0) {
            return;
        }

        // Compute current streak (simplified — just count consecutive days with XP events)
        int streak = computeSimpleStreak(userId);
        userNotificationService.onStreakReminder(userId, streak);
        log.debug("[DailyNotificationJob] STREAK_REMINDER sent to user {} — streak={}", userId, streak);
    }

    private int computeSimpleStreak(Long userId) {
        try {
            List<java.sql.Date> dates = jdbcTemplate.queryForList(
                    """
                    SELECT d FROM (
                        SELECT DATE(created_at) AS d, COUNT(*) as cnt 
                        FROM user_xp_events
                        WHERE user_id = ? 
                        GROUP BY DATE(created_at)
                    ) sub WHERE cnt >= 2 ORDER BY d DESC LIMIT 60
                    """, java.sql.Date.class, userId);
            if (dates.isEmpty()) return 0;

            java.time.LocalDate prev = java.time.LocalDate.now();
            if (!dates.contains(java.sql.Date.valueOf(prev))) {
                prev = prev.minusDays(1);
            }
            int streak = 0;
            for (java.sql.Date d : dates) {
                java.time.LocalDate ld = d.toLocalDate();
                if (ld.equals(prev)) {
                    streak++;
                    prev = prev.minusDays(1);
                } else if (ld.isBefore(prev)) {
                    break;
                }
            }
            return streak;
        } catch (Exception e) {
            return 0;
        }
    }
}
