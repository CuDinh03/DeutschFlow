package com.deutschflow.messaging.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.messaging.dto.ClassChannelDtos.ClassMessageDto;
import com.deutschflow.messaging.entity.ClassChannelMessage;
import com.deutschflow.messaging.repository.ClassChannelMessageRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Class group channel (P6): every member of a class (enrolled students + the class's teachers)
 * may post and read all messages. Membership is re-verified from the DB on every call.
 *
 * <p>Deletion is a SOFT delete (retains the row + original body for teacher audit). A member may
 * delete their own message; a teacher of the class may delete anyone's.
 */
@Service
@RequiredArgsConstructor
public class ClassChannelService {

    private final ClassChannelMessageRepository channelRepository;
    private final ClassStudentRepository classStudentRepository;
    private final ClassTeacherRepository classTeacherRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<ClassMessageDto> listMessages(Long userId, Long classId) {
        assertMember(userId, classId);
        boolean callerIsTeacher = isTeacher(userId, classId);

        List<ClassChannelMessage> recent = channelRepository.findTop200ByClassIdOrderByIdDesc(classId);
        Map<Long, String> names = resolveNames(recent);

        // Oldest-first for display (the query returns newest-first for the LIMIT).
        return recent.stream()
                .sorted(Comparator.comparing(ClassChannelMessage::getId))
                .map(m -> toDto(m, userId, callerIsTeacher, names))
                .toList();
    }

    @Transactional
    public ClassMessageDto post(Long userId, Long classId, String body) {
        assertMember(userId, classId);
        ClassChannelMessage saved = channelRepository.save(ClassChannelMessage.builder()
                .classId(classId)
                .senderId(userId)
                .body(body)
                .createdAt(Instant.now())
                .build());
        return toDto(saved, userId, isTeacher(userId, classId), resolveNames(List.of(saved)));
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
