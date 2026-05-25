package com.deutschflow.notification.service;

import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.dto.MarkNotificationsReadResponse;
import com.deutschflow.notification.dto.NotificationItemResponse;
import com.deutschflow.notification.dto.NotificationPageResponse;
import com.deutschflow.notification.dto.NotificationUnreadCountResponse;
import com.deutschflow.notification.entity.UserNotification;
import com.deutschflow.notification.events.QuizAssignedEvent;
import com.deutschflow.notification.events.StudentRegisteredEvent;
import com.deutschflow.notification.repository.UserNotificationRepository;
import com.deutschflow.notification.sse.NotificationUnreadPushCoordinator;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.jdbc.core.JdbcTemplate;
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
    private final JdbcTemplate jdbcTemplate;

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

    /**
     * Called from SubscriptionActivationService after a successful payment.
     */
    @Transactional
    public void onLearnerSubscribed(long learnerUserId, String planCode) {
        User learner = userRepository.findById(learnerUserId).orElse(null);
        if (learner == null || !learner.isActive()) {
            return;
        }

        Map<String, Object> payloadTemplate = new LinkedHashMap<>();
        payloadTemplate.put("learnerUserId", learnerUserId);
        payloadTemplate.put("learnerEmail", learner.getEmail());
        payloadTemplate.put("learnerDisplayName", learner.getDisplayName());
        payloadTemplate.put("planCode", planCode);

        List<Long> adminIds = userRepository.findActiveIdsByRole(User.Role.ADMIN.name());
        for (Long adminId : adminIds) {
            User admin = userRepository.findById(adminId).orElse(null);
            if (admin == null || !admin.isActive() || admin.getRole() != User.Role.ADMIN) {
                continue;
            }
            insert(admin, NotificationType.ADMIN_LEARNER_SUBSCRIBED, payloadTemplate);
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

    // ── v1.5 — Classroom notifications ────────────────────────────────

    /**
     * Public helper so other services can insert a notification for a single user
     * without accessing the repository directly.
     */
    @Transactional
    public void insertForUser(User recipient, NotificationType type, Map<String, Object> payload) {
        insert(recipient, type, payload);
    }

    /**
     * Notify one or more teachers that a student requested to join their class.
     */
    @Transactional
    public void onTeacherJoinRequestCreated(Long teacherId, Long classId, String className,
                                            Long studentId, String studentName, String studentEmail) {
        User teacher = userRepository.findById(teacherId).orElse(null);
        if (teacher == null || !teacher.isActive()) return;

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("classId", classId);
        payload.put("className", className);
        payload.put("studentId", studentId);
        payload.put("studentName", studentName);
        payload.put("studentEmail", studentEmail);
        payload.put("action", "JOIN_REQUEST_CREATED");

        insert(teacher, NotificationType.CLASS_JOIN_REQUEST_CREATED, payload);
    }

    /**
     * Notify teachers when a submission is ready for review or grading was completed.
     */
    @Transactional
    public void onTeacherGradingEvent(Long teacherId, Long classId, String className, Long assignmentId,
                                      Long studentId, String studentName, String eventType, Integer score) {
        User teacher = userRepository.findById(teacherId).orElse(null);
        if (teacher == null || !teacher.isActive()) return;

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("classId", classId);
        payload.put("className", className);
        payload.put("assignmentId", assignmentId);
        payload.put("studentId", studentId);
        payload.put("studentName", studentName);
        payload.put("eventType", eventType);
        payload.put("score", score);

        insert(teacher, NotificationType.QUIZ_SUBMISSION_RECEIVED, payload);
    }

    /**
     * Called when a teacher approves a student's classroom join request.
     */
    @Transactional
    public void onJoinRequestApproved(Long studentId, Long classId, String className, String teacherName) {
        User student = userRepository.findById(studentId).orElse(null);
        if (student == null || !student.isActive()) return;

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("classId", classId);
        payload.put("className", className);
        payload.put("teacherName", teacherName);

        insert(student, NotificationType.JOIN_REQUEST_APPROVED, payload);
        log.info("[notifications] JOIN_REQUEST_APPROVED → student={} class={}", studentId, classId);
    }

    /**
     * Called when a teacher rejects a student's classroom join request.
     */
    @Transactional
    public void onJoinRequestRejected(Long studentId, Long classId, String className, String teacherName) {
        User student = userRepository.findById(studentId).orElse(null);
        if (student == null || !student.isActive()) return;

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("classId", classId);
        payload.put("className", className);
        payload.put("teacherName", teacherName);

        insert(student, NotificationType.JOIN_REQUEST_REJECTED, payload);
        log.info("[notifications] JOIN_REQUEST_REJECTED → student={} class={}", studentId, classId);
    }

    /**
     * Called when a teacher directly adds a student to a class (no invite flow).
     */
    @Transactional
    public void onAddedToClass(Long studentId, Long classId, String className, String teacherName) {
        User student = userRepository.findById(studentId).orElse(null);
        if (student == null || !student.isActive()) return;

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("classId", classId);
        payload.put("className", className);
        payload.put("teacherName", teacherName);

        insert(student, NotificationType.ADDED_TO_CLASS, payload);
        log.info("[notifications] ADDED_TO_CLASS → student={} class={}", studentId, classId);
    }

    /**
     * Called when a teacher grades a speaking session or class assignment.
     * @param assignmentType e.g. "SPEAKING" / "WRITING" / "GENERAL"
     */
    @Transactional
    public void onAssignmentGraded(Long studentId, String assignmentType, Long referenceId,
                                    Integer score, String feedback) {
        User student = userRepository.findById(studentId).orElse(null);
        if (student == null || !student.isActive()) return;

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("assignmentType", assignmentType);
        payload.put("referenceId", referenceId);
        payload.put("score", score);
        payload.put("feedback", feedback != null ? feedback : "");

        insert(student, NotificationType.ASSIGNMENT_GRADED, payload);
        log.info("[notifications] ASSIGNMENT_GRADED → student={} type={} score={}", studentId, assignmentType, score);
    }

    /**
     * Called when a teacher creates a new ClassAssignment (non-quiz) for a class.
     * Batch-inserts notifications for all students in the class.
     */
    @Async("taskExecutor")
    @Transactional
    public void onNewClassAssignment(Long classId, String className, String teacherName,
                                      Long assignmentId, String topic) {
        List<Long> studentIds = jdbcTemplate.queryForList(
            "SELECT student_id FROM class_students WHERE class_id = ?",
            Long.class, classId);

        if (studentIds.isEmpty()) return;

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("classId", classId);
        payload.put("className", className);
        payload.put("teacherName", teacherName);
        payload.put("assignmentId", assignmentId);
        payload.put("topic", topic);

        List<UserNotification> notifications = new ArrayList<>();
        for (Long studentId : studentIds) {
            User student = userRepository.findById(studentId).orElse(null);
            if (student != null && student.isActive()) {
                notifications.add(UserNotification.builder()
                    .recipient(student)
                    .type(NotificationType.NEW_CLASS_ASSIGNMENT)
                    .payload(new LinkedHashMap<>(payload))
                    .build());
            }
        }

        if (!notifications.isEmpty()) {
            notificationRepository.saveAll(notifications);
            for (UserNotification n : notifications) {
                unreadPushCoordinator.afterCommit(n.getRecipient().getId());
            }
            log.info("[notifications] NEW_CLASS_ASSIGNMENT → {} students in class={}", notifications.size(), classId);
        }
    }

    /**
     * Called asynchronously when a teacher publishes a quiz to a classroom.
     */
    @Async
    @Transactional
    @EventListener
    public void onQuizAssigned(QuizAssignedEvent event) {
        List<Long> studentIds = jdbcTemplate.queryForList("""
            SELECT student_id FROM class_students WHERE class_id = ?
            """, Long.class, event.classroomId());

        if (studentIds.isEmpty()) return;

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("quizId", event.quizId());
        payload.put("quizTitle", event.quizTitle());
        payload.put("teacherName", event.teacherName());
        payload.put("classroomName", event.classroomName());

        List<UserNotification> notifications = new ArrayList<>();
        for (Long studentId : studentIds) {
            User student = userRepository.findById(studentId).orElse(null);
            if (student != null && student.isActive()) {
                notifications.add(UserNotification.builder()
                        .recipient(student)
                        .type(NotificationType.NEW_ASSIGNMENT)
                        .payload(new LinkedHashMap<>(payload))
                        .build());
            }
        }

        if (!notifications.isEmpty()) {
            notificationRepository.saveAll(notifications);
            for (UserNotification n : notifications) {
                unreadPushCoordinator.afterCommit(n.getRecipient().getId());
            }
        }
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
