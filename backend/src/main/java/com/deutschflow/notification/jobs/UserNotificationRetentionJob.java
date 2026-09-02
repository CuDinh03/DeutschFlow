package com.deutschflow.notification.jobs;

import com.deutschflow.notification.service.UserNotificationRetentionService;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Nightly purge of READ user notifications past the retention window, so {@code user_notifications}
 * doesn't grow forever (every admin broadcast to ALL adds one row per user). Unread notifications
 * are never touched — only rows the recipient already read and left behind for
 * {@code app.notifications.retention.delete-read-older-than-days} days.
 *
 * <p>Thin scheduling shell: the delete itself lives in {@link UserNotificationRetentionService} so
 * its {@code @Transactional} boundary goes through a real Spring proxy — inlined here it would be a
 * self-invocation and the transaction would silently not exist.
 */
@Component
@Slf4j
public class UserNotificationRetentionJob {

    private final UserNotificationRetentionService retentionService;
    private final boolean enabled;
    private final int deleteReadOlderThanDays;

    public UserNotificationRetentionJob(
            UserNotificationRetentionService retentionService,
            @Value("${app.notifications.retention.enabled:true}") boolean enabled,
            @Value("${app.notifications.retention.delete-read-older-than-days:90}") int deleteReadOlderThanDays) {
        this.retentionService = retentionService;
        this.enabled = enabled;
        this.deleteReadOlderThanDays = Math.max(1, deleteReadOlderThanDays);
    }

    /** Runs nightly at 04:00 by default (after the 03:30 {@code DataRetentionJob} event purge). */
    @Scheduled(cron = "${app.notifications.retention.cron:0 0 4 * * *}")
    @SchedulerLock(name = "userNotificationRetention", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
    public void purgeReadNotifications() {
        if (!enabled) {
            return;
        }
        try {
            int deleted = retentionService.deleteReadNotificationsOlderThan(deleteReadOlderThanDays);
            if (deleted > 0) {
                log.info("[UserNotificationRetentionJob] deleted {} read notification(s) older than {}d",
                        deleted, deleteReadOlderThanDays);
            } else {
                log.debug("[UserNotificationRetentionJob] nothing to purge (window {}d)", deleteReadOlderThanDays);
            }
        } catch (RuntimeException e) {
            // Best-effort housekeeping — log and let the next nightly run retry.
            log.warn("[UserNotificationRetentionJob] purge failed: {}", e.getMessage(), e);
        }
    }
}
