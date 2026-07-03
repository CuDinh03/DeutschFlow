package com.deutschflow.messaging.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.messaging.dto.MessagingDtos.ConversationDto;
import com.deutschflow.messaging.dto.MessagingDtos.MessageDto;
import com.deutschflow.messaging.entity.Message;
import com.deutschflow.messaging.repository.MessageRepository;
import com.deutschflow.moderation.service.UserBlockService;
import com.deutschflow.moderation.service.WordFilterService;
import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Direct 1-1 messaging between a student and a teacher who <b>share a class</b> (the student is
 * enrolled in a class the other teaches, or vice versa). Authz is re-verified from the DB on every
 * send/read — the pairing is never trusted from the client.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MessageService {

    private static final int PREVIEW_MAX = 120;

    private final MessageRepository messageRepository;
    private final ClassTeacherRepository classTeacherRepository;
    private final ClassStudentRepository classStudentRepository;
    private final UserRepository userRepository;
    private final UserNotificationService notificationService;
    private final UserBlockService blockService;
    private final WordFilterService wordFilter;

    /** Sends a message; recipient gets a NEW_MESSAGE notification (best-effort). */
    @Transactional
    public MessageDto send(Long senderId, Long recipientId, String body) {
        assertCanMessage(senderId, recipientId);
        if (blockService.isBlockedEitherWay(senderId, recipientId)) {
            throw new ForbiddenException("Không thể gửi tin — một trong hai người đã chặn người kia.");
        }
        wordFilter.assertClean(body);
        User recipient = userRepository.findById(recipientId)
                .orElseThrow(() -> new NotFoundException("Người nhận không tồn tại."));

        Message saved = messageRepository.save(Message.builder()
                .senderId(senderId)
                .recipientId(recipientId)
                .body(body.trim())
                .build());

        notifyRecipient(recipient, senderId, saved.getBody());
        return toDto(saved, senderId);
    }

    /** Full thread with another user (oldest → newest); marks incoming messages read as a side effect. */
    @Transactional
    public List<MessageDto> getThread(Long me, Long otherId) {
        assertCanMessage(me, otherId);
        List<Message> thread = messageRepository
                .findBySenderIdAndRecipientIdOrSenderIdAndRecipientIdOrderByIdAsc(me, otherId, otherId, me);
        messageRepository.markThreadRead(me, otherId, Instant.now());
        Set<Long> blocked = blockService.blockedIds(me);
        return thread.stream()
                .filter(m -> !blocked.contains(m.getSenderId()))
                .map(m -> toDto(m, me)).toList();
    }

    /** Marks the thread from {@code otherId} as read; returns how many were updated. */
    @Transactional
    public int markRead(Long me, Long otherId) {
        return messageRepository.markThreadRead(me, otherId, Instant.now());
    }

    /** Total unread messages across all threads (conversation-list badge). */
    @Transactional(readOnly = true)
    public long totalUnread(Long me) {
        return messageRepository.countByRecipientIdAndReadAtIsNull(me);
    }

    /** Conversation summaries (one per counterpart), most-recent first. */
    @Transactional(readOnly = true)
    public List<ConversationDto> listConversations(Long me) {
        List<Message> recent = messageRepository.findTop300BySenderIdOrRecipientIdOrderByIdDesc(me, me);
        Set<Long> blocked = blockService.blockedIds(me);
        LinkedHashMap<Long, Message> lastByOther = new LinkedHashMap<>();
        Map<Long, Long> unreadByOther = new java.util.HashMap<>();
        for (Message m : recent) {
            Long other = m.getSenderId().equals(me) ? m.getRecipientId() : m.getSenderId();
            if (blocked.contains(other)) {
                continue;
            }
            lastByOther.putIfAbsent(other, m); // desc order → first seen is the latest
            if (m.getRecipientId().equals(me) && m.getReadAt() == null) {
                unreadByOther.merge(other, 1L, Long::sum);
            }
        }
        if (lastByOther.isEmpty()) {
            return List.of();
        }
        Map<Long, User> users = userRepository.findAllById(lastByOther.keySet()).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        return lastByOther.entrySet().stream()
                .map(e -> {
                    User u = users.get(e.getKey());
                    Message last = e.getValue();
                    return new ConversationDto(
                            e.getKey(),
                            u != null ? u.getDisplayName() : null,
                            u != null ? u.getEmail() : null,
                            preview(last.getBody()),
                            last.getCreatedAt(),
                            unreadByOther.getOrDefault(e.getKey(), 0L));
                })
                .toList();
    }

    // ----------------------------------------------------------------- internals

    /** A student and a teacher may message iff they share at least one teacher↔student class. */
    private void assertCanMessage(Long a, Long b) {
        if (a.equals(b)) {
            throw new BadRequestException("Không thể tự nhắn cho chính mình.");
        }
        boolean shared = overlaps(teacherClassIds(a), studentClassIds(b))
                || overlaps(teacherClassIds(b), studentClassIds(a));
        if (!shared) {
            throw new ForbiddenException("Chỉ nhắn tin được với giáo viên hoặc học viên cùng lớp.");
        }
    }

    private Set<Long> teacherClassIds(Long userId) {
        return classTeacherRepository.findByIdTeacherId(userId).stream()
                .map(ct -> ct.getId().getClassId())
                .collect(Collectors.toSet());
    }

    private Set<Long> studentClassIds(Long userId) {
        return classStudentRepository.findByIdStudentId(userId).stream()
                .map(cs -> cs.getId().getClassId())
                .collect(Collectors.toSet());
    }

    private static boolean overlaps(Set<Long> a, Set<Long> b) {
        return !a.isEmpty() && !b.isEmpty() && !Collections.disjoint(a, b);
    }

    private void notifyRecipient(User recipient, Long senderId, String body) {
        try {
            User sender = userRepository.findById(senderId).orElse(null);
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("senderId", senderId);
            payload.put("senderName", sender != null ? sender.getDisplayName() : null);
            payload.put("preview", preview(body));
            notificationService.insertForUser(recipient, NotificationType.NEW_MESSAGE, payload);
        } catch (RuntimeException ex) {
            log.warn("[messaging] failed to notify recipient {} of new message: {}", recipient.getId(), ex.getMessage());
        }
    }

    private MessageDto toDto(Message m, Long me) {
        return new MessageDto(m.getId(), m.getSenderId(), m.getRecipientId(), m.getBody(),
                m.getCreatedAt(), m.getReadAt(), m.getSenderId().equals(me));
    }

    private static String preview(String body) {
        String trimmed = body == null ? "" : body.strip();
        return trimmed.length() <= PREVIEW_MAX ? trimmed : trimmed.substring(0, PREVIEW_MAX) + "…";
    }
}
