package com.deutschflow.notification.jobs;

import com.deutschflow.notification.repository.UserNotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Removes read inbox rows older than a configurable retention window to bound table growth.
 */
@Component
@ConditionalOnProperty(name = "app.notifications.retention.enabled", havingValue = "true", matchIfMissing = true)
@Slf4j
@RequiredArgsConstructor
public class UserNotificationRetentionJob {

    private final UserNotificationRepository notificationRepository;

    @Value("${app.notifications.retention.delete-read-older-than-days:90}")
    private int deleteReadOlderThanDays;

    @Scheduled(cron = "${app.notifications.retention.cron:0 0 4 * * *}")
    @Transactional
    public void pruneReadNotifications() {
        int days = Math.max(7, Math.min(deleteReadOlderThanDays, 3650));
        LocalDateTime cutoff = LocalDateTime.now().minusDays(days);
        int deleted = notificationRepository.deleteByReadAtIsNotNullAndReadAtBefore(cutoff);
        if (deleted > 0) {
            log.info("[notifications] retention: deleted {} read rows older than {} days", deleted, days);
        }
    }
}
