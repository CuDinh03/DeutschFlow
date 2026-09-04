package com.deutschflow.notification.service;

import com.deutschflow.notification.repository.UserNotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Retention delete for {@code user_notifications}, kept as its own bean so the scheduled job calls
 * {@code @Transactional} through a Spring proxy (a same-bean call would skip it). The cutoff uses
 * plain {@link LocalDateTime#now()} — the same clock {@code UserNotificationService} uses when it
 * writes {@code readAt}.
 */
@Service
@RequiredArgsConstructor
public class UserNotificationRetentionService {

    private final UserNotificationRepository notificationRepository;

    /**
     * Deletes notifications that were read more than {@code days} days ago. Unread rows
     * ({@code readAt IS NULL}) are never deleted, regardless of age.
     *
     * @return number of rows deleted
     */
    @Transactional
    public int deleteReadNotificationsOlderThan(int days) {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(days);
        return notificationRepository.deleteByReadAtIsNotNullAndReadAtBefore(cutoff);
    }
}
