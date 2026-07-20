package com.deutschflow.messaging.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.messaging.dto.ClassChannelDtos.ClassMessageDto;
import com.deutschflow.messaging.entity.ClassChannelMessage;
import com.deutschflow.messaging.repository.ClassChannelMessageRepository;
import com.deutschflow.moderation.service.UserBlockService;
import com.deutschflow.moderation.service.WordFilterService;
import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.notification.service.NotificationAutoAckService;
import com.deutschflow.common.transaction.RunAfterCommitService;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Class group channel (P6): every member of a class (enrolled students + the class's teachers)
 * may post and read all messages. Membership is re-verified from the DB on every call.
 *
 * <p>Deletion is a SOFT delete (retains the row + original body for teacher audit). A member may
 * delete their own message; a teacher of the class may delete anyone's.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ClassChannelService {

    /** Max characters of the body carried in a notification preview (matches DM messaging). */
    private static final int PREVIEW_MAX = 120;

    private final ClassChannelMessageRepository channelRepository;
    private final ClassStudentRepository classStudentRepository;
    private final ClassTeacherRepository classTeacherRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final UserRepository userRepository;
    private final WordFilterService wordFilter;
    private final UserBlockService blockService;
    private final UserNotificationService notificationService;
    private final NotificationAutoAckService notificationAutoAckService;
    private final RunAfterCommitService runAfterCommitService;

    @Transactional(readOnly = true)
    public List<ClassMessageDto> listMessages(Long userId, Long classId) {
        assertMember(userId, classId);
        boolean callerIsTeacher = isTeacher(userId, classId);

        // Mở kênh chat lớp = đã xem → thông báo "💬 [tên lớp]" (CLASS_CHANNEL_MESSAGE) của lớp này không
        // còn "mới". Kênh không có read-state riêng nên mở màn là tín hiệu duy nhất. Sau commit của tx
        // readOnly này (chạy tx ghi riêng), best-effort.
        final Long ackUserId = userId;
        final Long ackClassId = classId;
        runAfterCommitService.run(() -> notificationAutoAckService.ackByContext(
                ackUserId,
                Set.of(NotificationType.CLASS_CHANNEL_MESSAGE),
                Map.<String, Object>of("classId", ackClassId)));

        List<ClassChannelMessage> recent = channelRepository.findTop200ByClassIdOrderByIdDesc(classId);
        Set<Long> blocked = blockService.blockedIds(userId);
        Map<Long, String> names = resolveNames(recent);

        // Oldest-first for display (the query returns newest-first for the LIMIT).
        return recent.stream()
                .filter(m -> !blocked.contains(m.getSenderId()))
                .sorted(Comparator.comparing(ClassChannelMessage::getId))
                .map(m -> toDto(m, userId, callerIsTeacher, names))
                .toList();
    }

    @Transactional
    public ClassMessageDto post(Long userId, Long classId, String body) {
        assertMember(userId, classId);
        wordFilter.assertClean(body);
        ClassChannelMessage saved = channelRepository.save(ClassChannelMessage.builder()
                .classId(classId)
                .senderId(userId)
                .body(body)
                .createdAt(Instant.now())
                .build());
        Map<Long, String> names = resolveNames(List.of(saved));
        notifyMembers(classId, userId, names.getOrDefault(userId, "Thành viên"), saved.getBody());
        return toDto(saved, userId, isTeacher(userId, classId), names);
    }

    /** Soft-delete: a member may delete their own message; a teacher of the class may delete any. */
    @Transactional
    public ClassMessageDto delete(Long userId, Long classId, Long messageId) {
        assertMember(userId, classId);
        ClassChannelMessage msg = channelRepository.findById(messageId)
                .filter(m -> m.getClassId().equals(classId))
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tin nhắn"));

        boolean callerIsTeacher = isTeacher(userId, classId);
        boolean canDelete = msg.getSenderId().equals(userId) || callerIsTeacher;
        if (!canDelete) {
            throw new ForbiddenException("Bạn không thể xoá tin nhắn này");
        }

        if (msg.getDeletedAt() == null) {
            msg.setDeletedAt(Instant.now());
            msg.setDeletedBy(userId);          // audit trail — original body is retained
            channelRepository.save(msg);
        }
        return toDto(msg, userId, callerIsTeacher, resolveNames(List.of(msg)));
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    /**
     * Best-effort fan-out of a new channel message to every other member. Runs the actual delivery
     * off-thread ({@link UserNotificationService#notifyClassChannelMessage}); this method only
     * resolves the class name synchronously and swallows any failure so a notification problem can
     * never break the sender's post.
     */
    private void notifyMembers(Long classId, Long senderId, String senderName, String body) {
        try {
            String className = teacherClassRepository.findById(classId)
                    .map(TeacherClass::getName)
                    .orElse("Chat lớp");
            notificationService.notifyClassChannelMessage(classId, className, senderId, senderName, preview(body));
        } catch (RuntimeException ex) {
            log.warn("[class-channel] failed to notify members of class {} message: {}", classId, ex.getMessage());
        }
    }

    private static String preview(String body) {
        String trimmed = body == null ? "" : body.strip();
        return trimmed.length() <= PREVIEW_MAX ? trimmed : trimmed.substring(0, PREVIEW_MAX) + "…";
    }

    private ClassMessageDto toDto(ClassChannelMessage m, Long userId, boolean callerIsTeacher,
                                  Map<Long, String> names) {
        boolean deleted = m.getDeletedAt() != null;
        boolean mine = m.getSenderId().equals(userId);
        // Deleted content is never sent to clients (only the teacher-facing audit keeps it).
        String body = deleted ? null : m.getBody();
        boolean canDelete = !deleted && (mine || callerIsTeacher);
        return new ClassMessageDto(
                m.getId(),
                m.getSenderId(),
                names.getOrDefault(m.getSenderId(), "Thành viên"),
                body,
                m.getCreatedAt(),
                mine,
                deleted,
                canDelete);
    }

    private Map<Long, String> resolveNames(List<ClassChannelMessage> messages) {
        List<Long> ids = messages.stream().map(ClassChannelMessage::getSenderId).distinct().toList();
        if (ids.isEmpty()) return Map.of();
        return userRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(User::getId,
                        u -> u.getDisplayName() != null ? u.getDisplayName() : "Thành viên"));
    }

    private void assertMember(Long userId, Long classId) {
        boolean member = classStudentRepository.existsByIdClassIdAndIdStudentId(classId, userId)
                || classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, userId);
        if (!member) {
            throw new ForbiddenException("Bạn không thuộc lớp này");
        }
    }

    private boolean isTeacher(Long userId, Long classId) {
        return classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, userId);
    }
}
