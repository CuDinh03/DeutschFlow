package com.deutschflow.notification.service;

import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.dto.MarkNotificationsReadResponse;
import com.deutschflow.notification.dto.NotificationItemResponse;
import com.deutschflow.notification.dto.NotificationPageResponse;
import com.deutschflow.notification.dto.NotificationUnreadCountResponse;
import com.deutschflow.notification.entity.UserNotification;
import com.deutschflow.notification.events.StudentRegisteredEvent;
import com.deutschflow.notification.repository.UserNotificationRepository;
import com.deutschflow.notification.sse.NotificationUnreadPushCoordinator;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserNotificationService {

    private final UserNotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final NotificationUnreadPushCoordinator unreadPushCoordinator;

    @Transactional(readOnly = true)
    public NotificationPageResponse listForRecipient(long recipientUserId, int page, int size, Boolean unreadOnly) {
        PageRequest pr = PageRequest.of(Math.max(0, page), normalizeSize(size));
        Page<UserNotification> result = Boolean.TRUE.equals(unreadOnly)
                ? notificationRepository.findByRecipient_IdAndReadAtIsNullOrderByIdDesc(recipientUserId, pr)
                : notificationRepository.findByRecipient_IdOrderByIdDesc(recipientUserId, pr);
        List<NotificationItemResponse> items = new ArrayList<>(result.getNumberOfElements());
        for (UserNotification n : result.getContent()) {
            items.add(toDto(n));
        }
        return new NotificationPageResponse(
                items,
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages()
        );
    }

    @Transactional(readOnly = true)
    public NotificationUnreadCountResponse unreadCount(long recipientUserId) {
        return new NotificationUnreadCountResponse(notificationRepository.countByRecipient_IdAndReadAtIsNull(recipientUserId));
    }

    @Transactional
    public MarkNotificationsReadResponse markRead(long recipientUserId, long notificationId) {
        LocalDateTime now = LocalDateTime.now();
        int rows = notificationRepository.markOneRead(recipientUserId, notificationId, now);
        unreadPushCoordinator.afterCommit(recipientUserId);
        return new MarkNotificationsReadResponse(rows);
    }

    @Transactional
    public MarkNotificationsReadResponse markAllRead(long recipientUserId) {
        int rows = notificationRepository.markAllReadForUser(recipientUserId, LocalDateTime.now());
        unreadPushCoordinator.afterCommit(recipientUserId);
        return new MarkNotificationsReadResponse(rows);
    }

    /**
     * Runs in a new transaction after registration commits.
     */
    @Transactional
    public void onStudentRegisteredAfterCommit(StudentRegisteredEvent event) {
        List<Long> adminIds = userRepository.findActiveIdsByRole(User.Role.ADMIN.name());
        if (adminIds.isEmpty()) {
            log.warn("[notifications] USER_REGISTERED skipped: no active ADMIN rows in users table");
            return;
        }
        Map<String, Object> payloadTemplate = new LinkedHashMap<>();
        payloadTemplate.put("newStudentId", event.newStudentId());
        payloadTemplate.put("email", event.email());
        payloadTemplate.put("displayName", event.displayName());

        for (Long adminId : adminIds) {
            User admin = userRepository.findById(adminId).orElse(null);
            if (admin == null || !admin.isActive() || admin.getRole() != User.Role.ADMIN) {
                continue;
            }
            insert(admin, NotificationType.USER_REGISTERED, payloadTemplate);
        }
    }

    /**
     * Called from the admin API after {@code updateUserPlan} has committed.
     */
    @Transactional
    public void onLearnerPlanChangedByAdmin(
            long learnerUserId,
            Map<String, Object> updateSummary,
            long actingAdminUserId,
            String actingAdminEmail) {
        User learner = userRepository.findById(learnerUserId).orElse(null);
        if (learner == null || !learner.isActive()) {
            return;
        }

        Map<String, Object> learnerPayload = new LinkedHashMap<>();
        learnerPayload.put("planCode", String.valueOf(updateSummary.get("planCode")));

        insert(learner, NotificationType.LEARNER_PLAN_UPDATED, learnerPayload);

        Map<String, Object> auditTemplate = new LinkedHashMap<>();
        auditTemplate.put("learnerUserId", learnerUserId);
        auditTemplate.put("learnerEmail", String.valueOf(updateSummary.get("email")));
        auditTemplate.put("learnerDisplayName", String.valueOf(updateSummary.get("displayName")));
        auditTemplate.put("planCode", String.valueOf(updateSummary.get("planCode")));
        auditTemplate.put("actingAdminUserId", actingAdminUserId);
        auditTemplate.put("actingAdminEmail", actingAdminEmail != null ? actingAdminEmail : "");

        List<Long> adminIds = userRepository.findActiveIdsByRole(User.Role.ADMIN.name());
        for (Long adminId : adminIds) {
            User admin = userRepository.findById(adminId).orElse(null);
            if (admin == null || !admin.isActive() || admin.getRole() != User.Role.ADMIN) {
                continue;
            }
            insert(admin, NotificationType.ADMIN_LEARNER_PLAN_CHANGED, auditTemplate);
        }
    }

    // ── v1.4 — Gamification & engagement notifications ──────────────────

    /**
     * Called from XpService when a student unlocks a new achievement.
     */
    @Transactional
    public void onAchievementUnlocked(Long userId, String achievementCode, String achievementName,
                                       String iconEmoji, int xpReward) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || !user.isActive()) return;

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("achievementCode", achievementCode);
        payload.put("achievementName", achievementName);
        payload.put("iconEmoji", iconEmoji);
        payload.put("xpReward", xpReward);

        insert(user, NotificationType.ACHIEVEMENT_UNLOCKED, payload);
        log.info("[notifications] ACHIEVEMENT_UNLOCKED for user {} — {}", userId, achievementCode);
    }

    /**
     * Called from XpService when a student levels up.
     */
    @Transactional
    public void onLevelUp(Long userId, int oldLevel, int newLevel, long totalXp) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || !user.isActive()) return;

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("oldLevel", oldLevel);
        payload.put("newLevel", newLevel);
        payload.put("totalXp", totalXp);

        insert(user, NotificationType.LEVEL_UP, payload);
        log.info("[notifications] LEVEL_UP for user {} — Lv.{} → Lv.{}", userId, oldLevel, newLevel);
    }

    /**
     * Called from scheduled job: student has N review cards due today.
     */
    @Transactional
    public void onReviewDue(Long userId, int dueCount) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || !user.isActive()) return;

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("dueCount", dueCount);
        payload.put("message", "Bạn có " + dueCount + " thẻ cần ôn tập hôm nay");

        insert(user, NotificationType.REVIEW_DUE, payload);
    }

    /**
     * Called from scheduled job: student hasn't studied today — streak at risk.
     */
    @Transactional
    public void onStreakReminder(Long userId, int currentStreak) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || !user.isActive()) return;

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("currentStreak", currentStreak);
        payload.put("message", currentStreak > 0
                ? "Đừng quên học hôm nay! Chuỗi hiện tại: " + currentStreak + " ngày"
                : "Hãy bắt đầu học ngay để xây dựng chuỗi streak!");

        insert(user, NotificationType.STREAK_REMINDER, payload);
    }

    private void insert(User recipient, NotificationType type, Map<String, Object> payload) {
        notificationRepository.save(UserNotification.builder()
                .recipient(recipient)
                .type(type)
                .payload(new LinkedHashMap<>(payload))
                .build());
        unreadPushCoordinator.afterCommit(recipient.getId());
    }

    private static int normalizeSize(int size) {
        if (size < 1) {
            return 20;
        }
        return Math.min(size, 100);
    }

    private static NotificationItemResponse toDto(UserNotification n) {
        Map<String, Object> p = n.getPayload();
        if (p == null) {
            p = Map.of();
        }
        return new NotificationItemResponse(
                n.getId(),
                n.getType(),
                p,
                n.getReadAt() != null,
                n.getCreatedAt().atOffset(ZoneOffset.UTC).toInstant()
        );
    }
}
