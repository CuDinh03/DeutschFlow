package com.deutschflow.notification.jobs;

import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

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

    private final UserRepository userRepository;
    private final UserNotificationService userNotificationService;
    private final JdbcTemplate jdbcTemplate;

    private static final int REVIEW_DUE_HOUR = 8;
    private static final int STREAK_REMINDER_HOUR = 18;

    /**
     * Runs every hour at minute 0. Checks which users are in the target hour
     * and sends them the appropriate notification.
     */
    @Scheduled(cron = "0 0 * * * *")
    public void checkAndSendDailyNotifications() {
        log.debug("[DailyNotificationJob] Hourly check started");

        List<User> students = userRepository.findByRoleAndActiveTrue(User.Role.STUDENT);

        for (User student : students) {
            try {
                String tzStr = student.getNotificationTimezone();
                if (tzStr == null || tzStr.isBlank()) {
                    tzStr = "Asia/Ho_Chi_Minh";
                }
                ZoneId tz;
                try {
                    tz = ZoneId.of(tzStr);
                } catch (Exception e) {
                    tz = ZoneId.of("Asia/Ho_Chi_Minh");
                }

                ZonedDateTime nowInUserTz = ZonedDateTime.now(tz);
                int currentHour = nowInUserTz.getHour();

                if (currentHour == REVIEW_DUE_HOUR) {
                    sendReviewDueIfNeeded(student);
                }
                if (currentHour == STREAK_REMINDER_HOUR) {
                    sendStreakReminderIfNeeded(student);
                }
            } catch (Exception e) {
                log.warn("[DailyNotificationJob] Error processing user {}: {}", student.getId(), e.getMessage());
            }
        }
    }

    private void sendReviewDueIfNeeded(User student) {
        // Count due review items for this user
        Integer dueCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM review_queue WHERE user_id = ? AND next_review_at <= NOW()",
                Integer.class, student.getId());

        if (dueCount != null && dueCount > 0) {
            // Check if we already sent a REVIEW_DUE today (avoid duplicates)
            Long alreadySent = jdbcTemplate.queryForObject(
                    """
                    SELECT COUNT(*) FROM user_notifications
                    WHERE recipient_id = ? AND type = 'REVIEW_DUE'
                      AND created_at >= CURRENT_DATE
                    """, Long.class, student.getId());

            if (alreadySent == null || alreadySent == 0) {
                userNotificationService.onReviewDue(student.getId(), dueCount);
                log.debug("[DailyNotificationJob] REVIEW_DUE sent to user {} — {} cards", student.getId(), dueCount);
            }
        }
    }

    private void sendStreakReminderIfNeeded(User student) {
        // Check if user has any activity today (XP events or session progress)
        Long activityToday = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM user_xp_events
                WHERE user_id = ? AND created_at >= CURRENT_DATE
                """, Long.class, student.getId());

        if (activityToday != null && activityToday > 0) {
            return; // User already studied today — no reminder needed
        }

        // Check if already sent today
        Long alreadySent = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM user_notifications
                WHERE recipient_id = ? AND type = 'STREAK_REMINDER'
                  AND created_at >= CURRENT_DATE
                """, Long.class, student.getId());

        if (alreadySent != null && alreadySent > 0) {
            return;
        }

        // Compute current streak (simplified — just count consecutive days with XP events)
        int streak = computeSimpleStreak(student.getId());
        userNotificationService.onStreakReminder(student.getId(), streak);
        log.debug("[DailyNotificationJob] STREAK_REMINDER sent to user {} — streak={}", student.getId(), streak);
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
