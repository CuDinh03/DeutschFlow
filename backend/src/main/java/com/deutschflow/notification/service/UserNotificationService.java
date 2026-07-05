package com.deutschflow.notification.service;

import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.dto.BroadcastNotificationRequest;
import com.deutschflow.notification.dto.BroadcastNotificationResponse;
import com.deutschflow.notification.dto.MarkNotificationsReadResponse;
import com.deutschflow.notification.dto.NotificationItemResponse;
import com.deutschflow.notification.dto.NotificationPageResponse;
import com.deutschflow.notification.dto.NotificationUnreadCountResponse;
import com.deutschflow.notification.entity.ScheduledBroadcast;
import com.deutschflow.notification.entity.UserNotification;
import com.deutschflow.notification.events.StudentRegisteredEvent;
import com.deutschflow.notification.repository.ScheduledBroadcastRepository;
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
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
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
    private final ScheduledBroadcastRepository scheduledBroadcastRepository;
    private final ExpoPushSenderService expoPushSenderService;
    private final NotificationContentRenderer contentRenderer;

    /** A scheduledAt within this window of "now" is treated as immediate delivery. */
    private static final long SCHEDULE_THRESHOLD_SECONDS = 30;

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
     * Runs in a new transaction after a self-service registration commits.
     */
    @Transactional
    public void onStudentRegisteredAfterCommit(StudentRegisteredEvent event) {
        notifyAdminsOfNewAccount(event.newStudentId(), event.email(), event.displayName(), "SELF");
    }

    /**
     * Notifies every active admin that a new account was provisioned by staff
     * (admin panel / org OWNER / MANAGER), so the "new account" audit trail is
     * complete regardless of how the account was created.
     *
     * @param via one of {@code ADMIN}, {@code MANAGER}, {@code OWNER}, {@code CSV}
     */
    @Transactional
    public void onAccountProvisioned(long newUserId, String email, String displayName, String via) {
        notifyAdminsOfNewAccount(newUserId, email, displayName, via);
    }

    private void notifyAdminsOfNewAccount(long newUserId, String email, String displayName, String via) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("newStudentId", newUserId);
        payload.put("email", email);
        payload.put("displayName", displayName);
        payload.put("via", via == null ? "SELF" : via);
        int notified = notifyAllAdmins(NotificationType.USER_REGISTERED, payload);
        if (notified == 0) {
            log.warn("[notifications] USER_REGISTERED skipped: no active ADMIN rows in users table");
        }
    }

    /**
     * Notifies every active admin that a user permanently deleted their account.
     * The user row is already gone by the time this runs, so identity comes from
     * the captured {@code email}/{@code displayName}, not a lookup.
     */
    @Transactional
    public void onAccountDeleted(long deletedUserId, String email, String displayName) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("deletedUserId", deletedUserId);
        payload.put("email", email);
        payload.put("displayName", displayName);
        notifyAllAdmins(NotificationType.ACCOUNT_DELETED, payload);
    }

    /**
     * Notifies every active admin that a learner's subscription ended.
     *
     * @param reason one of {@code EXPIRED}, {@code REFUNDED}, {@code REVOKED}, {@code CANCELLED}
     */
    @Transactional
    public void onLearnerSubscriptionEnded(long learnerUserId, String planCode, String reason) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("learnerUserId", learnerUserId);
        userRepository.findById(learnerUserId)
                .ifPresent(u -> payload.put("learnerEmail", u.getEmail()));
        payload.put("planCode", planCode);
        payload.put("reason", reason == null ? "EXPIRED" : reason);
        notifyAllAdmins(NotificationType.ADMIN_LEARNER_SUBSCRIPTION_ENDED, payload);
    }

    /**
     * Notifies every active admin of a background/system failure worth attention
     * (e.g. AI grading failed). Generic ops-alert channel — reuse for future signals.
     *
     * @param source short machine tag for the origin, e.g. {@code AI_GRADING}
     */
    @Transactional
    public void onSystemAlert(String source, String title, String message, Map<String, Object> extra) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("source", source);
        payload.put("title", title);
        payload.put("message", message);
        if (extra != null) {
            extra.forEach(payload::putIfAbsent);
        }
        notifyAllAdmins(NotificationType.ADMIN_SYSTEM_ALERT, payload);
    }

    /** Notifies every active admin that a new organization was created. */
    @Transactional
    public void onOrgCreated(long orgId, String orgName, String slug) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("orgId", orgId);
        payload.put("orgName", orgName);
        payload.put("slug", slug);
        notifyAllAdmins(NotificationType.ADMIN_ORG_CREATED, payload);
    }

    /** Notifies every active admin that an organization invoice was marked paid. */
    @Transactional
    public void onOrgInvoicePaid(long orgId, String orgName, String paymentCode, long amountVnd) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("orgId", orgId);
        payload.put("orgName", orgName);
        payload.put("paymentCode", paymentCode);
        payload.put("amountVnd", amountVnd);
        notifyAllAdmins(NotificationType.ADMIN_ORG_INVOICE_PAID, payload);
    }

    /**
     * Inserts {@code type} for every active ADMIN. The payload is defensively copied per
     * recipient by {@link #insert}, so the same map is safe to pass for all admins.
     *
     * @return the number of admins notified
     */
    private int notifyAllAdmins(NotificationType type, Map<String, Object> payload) {
        List<Long> adminIds = userRepository.findActiveIdsByRole(User.Role.ADMIN.name());
        int notified = 0;
        for (Long adminId : adminIds) {
            User admin = userRepository.findById(adminId).orElse(null);
            if (admin == null || !admin.isActive() || admin.getRole() != User.Role.ADMIN) {
                continue;
            }
            insert(admin, type, payload);
            notified++;
        }
        return notified;
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
                pushForNotification(n);
            }
            log.info("[notifications] NEW_CLASS_ASSIGNMENT → {} students in class={}", notifications.size(), classId);
        }
    }

    // ── v1.6 — Admin broadcast & teacher announcement ────────────────────

    /**
     * Either delivers a broadcast immediately or, when {@code scheduledAt} is a future
     * timestamp, persists it as a {@link ScheduledBroadcast} for later dispatch by
     * {@link com.deutschflow.notification.jobs.ScheduledBroadcastJob}.
     *
     * <p>Runs synchronously so the returned {@link BroadcastNotificationResponse#recipientCount()}
     * reflects the real number of recipients (immediate path) — admin broadcasts are
     * infrequent, low-volume operations.
     *
     * @return {@code status} is one of {@code sent}, {@code scheduled}, or {@code no_recipients}.
     */
    @Transactional
    public BroadcastNotificationResponse broadcastToAudience(BroadcastNotificationRequest request) {
        LocalDateTime scheduledAt = parseScheduledAt(request.scheduledAt());
        LocalDateTime threshold = LocalDateTime.now(ZoneOffset.UTC).plusSeconds(SCHEDULE_THRESHOLD_SECONDS);

        if (scheduledAt != null && scheduledAt.isAfter(threshold)) {
            ScheduledBroadcast scheduled = ScheduledBroadcast.builder()
                    .notificationType(resolveNotificationType(request.type()))
                    .audienceType(request.audienceType())
                    .tier(request.tier())
                    .role(request.role())
                    .targetEmail(request.targetEmail())
                    .title(request.payload().title())
                    .body(request.payload().body())
                    .scheduledAt(scheduledAt)
                    .status(ScheduledBroadcast.Status.PENDING)
                    .build();
            scheduledBroadcastRepository.save(scheduled);
            log.info("[notifications] broadcast scheduled for {} (UTC), audience={}", scheduledAt, request.audienceType());
            return new BroadcastNotificationResponse(0, "scheduled");
        }

        int count = deliverBroadcast(request);
        return new BroadcastNotificationResponse(count, count == 0 ? "no_recipients" : "sent");
    }

    /**
     * Fans a broadcast out into per-recipient notifications. Shared by the immediate
     * path and the scheduled-dispatch job. Returns the number of recipients notified.
     */
    @Transactional
    public int deliverBroadcast(BroadcastNotificationRequest request) {
        NotificationType notificationType = resolveNotificationType(request.type());

        List<User> recipients = resolveAudience(request);
        if (recipients.isEmpty()) {
            log.warn("[notifications] broadcast skipped — no recipients for audience={}", request.audienceType());
            return 0;
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("title", request.payload().title());
        payload.put("body", request.payload().body());
        payload.put("audienceType", request.audienceType());

        List<UserNotification> notifications = new ArrayList<>(recipients.size());
        for (User user : recipients) {
            notifications.add(UserNotification.builder()
                    .recipient(user)
                    .type(notificationType)
                    .payload(new LinkedHashMap<>(payload))
                    .build());
        }

        notificationRepository.saveAll(notifications);
        for (UserNotification n : notifications) {
            unreadPushCoordinator.afterCommit(n.getRecipient().getId());
            pushForNotification(n);
        }
        log.info("[notifications] {} broadcast → {} recipients, audience={}", notificationType, notifications.size(), request.audienceType());
        return notifications.size();
    }

    /**
     * Dispatches a due scheduled broadcast. Called by {@link com.deutschflow.notification.jobs.ScheduledBroadcastJob}.
     *
     * @return the number of recipients notified.
     */
    @Transactional
    public int dispatchScheduledBroadcast(ScheduledBroadcast scheduled) {
        BroadcastNotificationRequest request = new BroadcastNotificationRequest(
                scheduled.getNotificationType().name(),
                scheduled.getAudienceType(),
                scheduled.getTier(),
                scheduled.getRole(),
                scheduled.getTargetEmail(),
                new BroadcastNotificationRequest.Payload(scheduled.getTitle(), scheduled.getBody()),
                null);
        return deliverBroadcast(request);
    }

    /**
     * Parses an ISO-8601 timestamp (with or without offset) into a UTC {@link LocalDateTime}.
     * Returns {@code null} when blank. Throws {@link IllegalArgumentException} on malformed input.
     */
    static LocalDateTime parseScheduledAt(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(raw).atZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        } catch (DateTimeParseException ignored) {
            // fall through to offset-less parsing
        }
        try {
            return LocalDateTime.parse(raw);
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException("Invalid scheduledAt (expected ISO-8601): " + raw);
        }
    }

    /**
     * Creates a TEACHER_ANNOUNCEMENT notification for every active student in the given class.
     * The caller must have already verified the teacher is a member of the class.
     */
    @Transactional
    public int announceToClass(Long teacherId, String teacherName, Long classId, String className, String message) {
        List<Long> studentIds = jdbcTemplate.queryForList(
                "SELECT student_id FROM class_students WHERE class_id = ?",
                Long.class, classId);

        if (studentIds.isEmpty()) {
            log.info("[notifications] TEACHER_ANNOUNCEMENT skipped — no students in class={}", classId);
            return 0;
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("classId", classId);
        payload.put("className", className);
        payload.put("teacherId", teacherId);
        payload.put("teacherName", teacherName);
        payload.put("message", message);

        List<UserNotification> notifications = new ArrayList<>(studentIds.size());
        for (Long studentId : studentIds) {
            User student = userRepository.findById(studentId).orElse(null);
            if (student != null && student.isActive()) {
                notifications.add(UserNotification.builder()
                        .recipient(student)
                        .type(NotificationType.TEACHER_ANNOUNCEMENT)
                        .payload(new LinkedHashMap<>(payload))
                        .build());
            }
        }

        if (!notifications.isEmpty()) {
            notificationRepository.saveAll(notifications);
            for (UserNotification n : notifications) {
                unreadPushCoordinator.afterCommit(n.getRecipient().getId());
                pushForNotification(n);
            }
        }
        log.info("[notifications] TEACHER_ANNOUNCEMENT → {} students in class={}", notifications.size(), classId);
        return notifications.size();
    }

    /**
     * Fans a class-schedule change (new/cancelled/moved session, fixed schedule set or removed)
     * out to every active student in the class. Mirrors {@link #onNewClassAssignment}: runs
     * off the request thread so a slow push never blocks the teacher's save, and reads
     * {@code class_students} directly to batch-insert one notification per student.
     *
     * <p>The caller (schedule service) has already authorised the teacher and composed the
     * human-readable {@code message}; the teacher's display name is resolved here for the payload.
     *
     * @param type one of {@code CLASS_SESSION_SCHEDULED}, {@code CLASS_SESSION_CANCELLED},
     *             {@code CLASS_SESSION_RESCHEDULED}
     * @return the number of students notified
     */
    @Async("taskExecutor")
    @Transactional
    public void notifyClassScheduleEvent(NotificationType type, Long classId, String className,
                                         Long teacherId, String message) {
        List<Long> studentIds = jdbcTemplate.queryForList(
                "SELECT student_id FROM class_students WHERE class_id = ?",
                Long.class, classId);
        if (studentIds.isEmpty()) {
            log.info("[notifications] {} skipped — no students in class={}", type, classId);
            return;
        }

        String teacherName = teacherId == null ? "" : userRepository.findById(teacherId)
                .map(User::getDisplayName).orElse("");

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("classId", classId);
        payload.put("className", className);
        payload.put("teacherId", teacherId);
        payload.put("teacherName", teacherName);
        payload.put("message", message);

        List<UserNotification> notifications = new ArrayList<>(studentIds.size());
        for (Long studentId : studentIds) {
            User student = userRepository.findById(studentId).orElse(null);
            if (student != null && student.isActive()) {
                notifications.add(UserNotification.builder()
                        .recipient(student)
                        .type(type)
                        .payload(new LinkedHashMap<>(payload))
                        .build());
            }
        }

        if (!notifications.isEmpty()) {
            notificationRepository.saveAll(notifications);
            for (UserNotification n : notifications) {
                unreadPushCoordinator.afterCommit(n.getRecipient().getId());
                pushForNotification(n);
            }
        }
        log.info("[notifications] {} → {} students in class={}", type, notifications.size(), classId);
    }

    private List<User> resolveAudience(BroadcastNotificationRequest request) {
        return switch (request.audienceType().toUpperCase()) {
            // Filter at the DB rather than loading every user row into the JVM via findAll().
            case "ALL" -> userRepository.findByActiveTrue();
            case "ROLE" -> {
                if (request.role() == null || request.role().isBlank()) {
                    throw new IllegalArgumentException("role is required for ROLE audience");
                }
                yield userRepository.findByRoleAndActiveTrue(User.Role.valueOf(request.role().toUpperCase()));
            }
            case "TIER" -> {
                if (request.tier() == null || request.tier().isBlank()) {
                    throw new IllegalArgumentException("tier is required for TIER audience");
                }
                List<Long> ids = jdbcTemplate.queryForList(
                        "SELECT DISTINCT us.user_id FROM user_subscriptions us " +
                        "JOIN users u ON u.id = us.user_id " +
                        "WHERE us.plan_code = ? AND u.is_active IS TRUE AND us.status = 'ACTIVE' AND us.ends_at > NOW()",
                        Long.class, request.tier().toUpperCase());
                // Single IN-query instead of one findById() per id (N+1).
                yield ids.isEmpty() ? List.of()
                        : userRepository.findAllById(ids).stream()
                                .filter(User::isActive)
                                .toList();
            }
            case "SINGLE_USER" -> {
                if (request.targetEmail() == null || request.targetEmail().isBlank()) {
                    throw new IllegalArgumentException("targetEmail is required for SINGLE_USER audience");
                }
                yield userRepository.findByEmail(request.targetEmail())
                        .filter(User::isActive)
                        .map(List::of)
                        .orElse(List.of());
            }
            default -> throw new IllegalArgumentException("Unknown audienceType: " + request.audienceType());
        };
    }

    private static NotificationType resolveNotificationType(String type) {
        if (type == null || type.isBlank()) {
            return NotificationType.ADMIN_BROADCAST;
        }
        try {
            return NotificationType.valueOf(type.toUpperCase());
        } catch (IllegalArgumentException e) {
            return NotificationType.ADMIN_BROADCAST;
        }
    }

    private void insert(User recipient, NotificationType type, Map<String, Object> payload) {
        var saved = notificationRepository.save(UserNotification.builder()
                .recipient(recipient)
                .type(type)
                .payload(new LinkedHashMap<>(payload))
                .build());
        unreadPushCoordinator.afterCommit(recipient.getId());
        pushForNotification(saved);
    }

    /** Fire-and-forget Expo push for a persisted notification, if the recipient has a token. */
    private void pushForNotification(UserNotification n) {
        String token = n.getRecipient().getPushToken();
        if (token == null || token.isBlank()) return;
        Map<String, Object> p = n.getPayload() != null ? n.getPayload() : Map.of();
        // Use the shared renderer so the push text matches the in-app content exactly,
        // instead of the old raw-enum title / empty body fallback.
        NotificationContentRenderer.RenderedContent rendered = contentRenderer.render(n.getType(), p);
        // Carry the type + payload ids in the push `data` so tapping the OS notification can
        // deep-link to the right screen (mobile resolveNotificationRoute), same as an in-app tap.
        Map<String, Object> data = new LinkedHashMap<>(p);
        data.put("type", n.getType().name());
        expoPushSenderService.sendAsync(token, rendered.title(), rendered.body(), data);
    }

    private static int normalizeSize(int size) {
        if (size < 1) {
            return 20;
        }
        return Math.min(size, 100);
    }

    private NotificationItemResponse toDto(UserNotification n) {
        Map<String, Object> p = n.getPayload();
        if (p == null) {
            p = Map.of();
        }
        // Render title/body on read so the content is consistent across surfaces
        // and populated even for rows written before a type's payload had text.
        NotificationContentRenderer.RenderedContent rendered = contentRenderer.render(n.getType(), p);
        return new NotificationItemResponse(
                n.getId(),
                n.getType(),
                rendered.title(),
                rendered.body(),
                p,
                n.getReadAt() != null,
                n.getCreatedAt().atOffset(ZoneOffset.UTC).toInstant()
        );
    }
}
