package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.dto.ClassLessonLogDto;
import com.deutschflow.teacher.dto.SessionWorkspaceDto;
import com.deutschflow.teacher.entity.ClassRecordRevision;
import com.deutschflow.teacher.entity.ClassSession;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassRecordUnlockRepository;
import com.deutschflow.teacher.repository.ClassSessionRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Màn làm việc theo buổi (PR-7, spec §8/§2.3): gom dữ liệu ba khối Trước/Trong/Sau và luồng
 * CHỐT BUỔI — {@code completed_at/by} (schema V292) chỉ được đặt ở đây: buổi qua giờ KHÔNG tự
 * thành "đã dạy", giáo viên xác nhận mới tính. Bỏ chốt đi qua cửa sổ sửa hồi tố P07.
 */
@Service
@RequiredArgsConstructor
public class SessionWorkspaceService {

    private final ClassSessionRepository sessionRepo;
    private final ClassTeacherRepository classTeacherRepo;
    private final TeacherClassRepository classRepo;
    private final ClassStudentRepository classStudentRepo;
    private final ClassRecordUnlockRepository unlockRepo;
    private final UserRepository userRepository;
    private final SessionContentService sessionContentService;
    private final LessonLogService lessonLogService;
    private final ScheduleForecastService forecastService;
    private final RecordEditGuard recordEditGuard;
    private final com.deutschflow.teacher.repository.ClassAssignmentRepository assignmentRepo;
    private final com.deutschflow.teacher.repository.ClassAssignmentRecipientRepository assignmentRecipientRepo;

    @Transactional(readOnly = true)
    public SessionWorkspaceDto workspace(Long teacherId, Long sessionId) {
        ClassSession s = loadOwnedSession(teacherId, sessionId);

        // Nhật ký của CHÍNH buổi — lấy qua getLogs (kèm attendance + tên) rồi lọc theo sessionId.
        ClassLessonLogDto log = lessonLogService.getLogs(teacherId, s.getClassId()).stream()
                .filter(l -> sessionId.equals(l.sessionId()))
                .findFirst()
                .orElse(null);

        List<Long> studentIds = classStudentRepo.findByIdClassId(s.getClassId()).stream()
                .map(cs -> cs.getId().getStudentId())
                .toList();
        Map<Long, User> users = studentIds.isEmpty() ? Map.of()
                : userRepository.findAllById(studentIds).stream()
                        .collect(Collectors.toMap(User::getId, u -> u));
        List<SessionWorkspaceDto.RosterStudent> roster = studentIds.stream()
                .map(id -> new SessionWorkspaceDto.RosterStudent(id,
                        users.containsKey(id) ? users.get(id).getDisplayName() : "Học viên #" + id))
                .toList();

        boolean unlockActive = !unlockRepo.findActive(s.getClassId(), teacherId, sessionId,
                LocalDateTime.now()).isEmpty();
        return new SessionWorkspaceDto(
                s.getId(), s.getClassId(), className(s.getClassId()),
                s.getStartAt(), s.getDurationMinutes(), s.getTeachingMinutes(), s.getBreakMinutes(),
                s.getMode().name(), s.getRoom(), s.getStatus().name(),
                s.getCompletedAt(), s.getCompletedBy(),
                recordEditGuard.isEditable(s.getClassId(), teacherId, sessionId, s.getStartAt()),
                unlockActive,
                RecordEditGuard.EDIT_WINDOW_DAYS,
                sessionContentService.list(teacherId, sessionId),
                log,
                roster,
                forecastService.forecast(s.getClassId()),
                sessionAssignments(sessionId));
    }

    /**
     * Chốt buổi (spec §2.3): ghi nhận buổi ĐÃ DIỄN RA với kết quả thực tế. Buổi hủy không chốt
     * được; chốt hai lần → Conflict. Phần dở đã tự chuyển tiếp từ lúc xác nhận (PR-4) — chốt
     * không đụng phân bổ.
     */
    @Transactional
    public SessionWorkspaceDto complete(Long teacherId, Long sessionId) {
        ClassSession s = loadOwnedSession(teacherId, sessionId);
        if (s.getStatus() == ClassSession.Status.CANCELLED) {
            throw new BadRequestException("Buổi đã hủy — không chốt được");
        }
        if (s.getCompletedAt() != null) {
            throw new ConflictException("Buổi đã được chốt trước đó");
        }
        if (s.getStartAt().isAfter(LocalDateTime.now())) {
            throw new BadRequestException("Buổi chưa diễn ra — chưa chốt được");
        }
        s.setCompletedAt(LocalDateTime.now());
        s.setCompletedBy(teacherId);
        sessionRepo.save(s);
        recordEditGuard.revise(ClassRecordRevision.EntityType.SESSION_COMPLETION, sessionId,
                s.getClassId(), sessionId, teacherId, null, null,
                Map.of("completedAt", String.valueOf(s.getCompletedAt())));
        return workspace(teacherId, sessionId);
    }

    /** Bỏ chốt — đi qua cửa sổ sửa hồi tố P07 như mọi bản ghi khác của buổi. */
    @Transactional
    public SessionWorkspaceDto uncomplete(Long teacherId, Long sessionId) {
        ClassSession s = loadOwnedSession(teacherId, sessionId);
        if (s.getCompletedAt() == null) {
            throw new ConflictException("Buổi chưa được chốt");
        }
        recordEditGuard.assertEditable(s.getClassId(), teacherId, sessionId, s.getStartAt());
        Map<String, Object> before = Map.of("completedAt", String.valueOf(s.getCompletedAt()));
        s.setCompletedAt(null);
        s.setCompletedBy(null);
        sessionRepo.save(s);
        recordEditGuard.revise(ClassRecordRevision.EntityType.SESSION_COMPLETION, sessionId,
                s.getClassId(), sessionId, teacherId, null, before, null);
        return workspace(teacherId, sessionId);
    }

    /** Bài tập gắn CHÍNH buổi (spec §8) — giáo viên thấy cả nháp; học viên không đi qua đây. */
    private List<com.deutschflow.teacher.dto.ClassAssignmentDto> sessionAssignments(Long sessionId) {
        return assignmentRepo.findBySessionId(sessionId).stream()
                .map(a -> new com.deutschflow.teacher.dto.ClassAssignmentDto(
                        a.getId(), a.getClassId(), a.getTopic(), a.getDescription(),
                        a.getAssignmentType(), a.getSkill(), a.getReferenceId(), a.getDueDate(),
                        a.getCreatedAt(), a.getAttachmentUrl(), a.getLessonId(),
                        a.getStatus(), a.getPublishedAt(), a.getSessionId(), a.getLektionId(),
                        a.getCurriculumItemId(),
                        assignmentRecipientRepo.findByIdAssignmentId(a.getId()).size()))
                .toList();
    }

    private ClassSession loadOwnedSession(Long teacherId, Long sessionId) {
        ClassSession s = sessionRepo.findById(sessionId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy buổi học"));
        if (!classTeacherRepo.existsByIdClassIdAndIdTeacherId(s.getClassId(), teacherId)) {
            throw new ForbiddenException("Bạn không dạy lớp của buổi này");
        }
        return s;
    }

    private String className(Long classId) {
        return classRepo.findById(classId).map(TeacherClass::getName).orElse("Lớp #" + classId);
    }
}
