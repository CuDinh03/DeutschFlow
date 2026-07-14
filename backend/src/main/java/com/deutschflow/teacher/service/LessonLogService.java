package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.dto.ClassLessonLogDto;
import com.deutschflow.teacher.dto.CreateLessonLogRequest;
import com.deutschflow.teacher.entity.ClassAttendance;
import com.deutschflow.teacher.entity.ClassAttendanceId;
import com.deutschflow.teacher.entity.ClassLesson;
import com.deutschflow.teacher.entity.ClassLessonLog;
import com.deutschflow.teacher.repository.ClassAttendanceRepository;
import com.deutschflow.teacher.repository.ClassLessonLogRepository;
import com.deutschflow.teacher.repository.ClassLessonRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LessonLogService {

    private final ClassLessonLogRepository lessonLogRepository;
    private final ClassAttendanceRepository attendanceRepository;
    private final ClassTeacherRepository classTeacherRepository;
    private final ClassStudentRepository classStudentRepository;
    private final ClassLessonRepository lessonRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<ClassLessonLogDto> getLogs(Long teacherId, Long classId) {
        assertTeacherOwnsClass(teacherId, classId);
        List<ClassLessonLog> logs = lessonLogRepository
                .findByClassIdOrderBySessionDateAscSessionNumberAsc(classId);
        if (logs.isEmpty()) return List.of();

        List<Long> logIds = logs.stream().map(ClassLessonLog::getId).toList();
        List<ClassAttendance> allAttendance = attendanceRepository.findByLessonLogIds(logIds);
        Map<Long, List<ClassAttendance>> byLog = allAttendance.stream()
                .collect(Collectors.groupingBy(a -> a.getId().getLessonLogId()));

        // Load student names
        List<Long> studentIds = allAttendance.stream()
                .map(a -> a.getId().getStudentId()).distinct().toList();
        Map<Long, User> users = studentIds.isEmpty() ? Map.of()
                : userRepository.findAllById(studentIds).stream()
                        .collect(Collectors.toMap(User::getId, u -> u));

        // Batch-load titles of any linked lessons (N+1-safe).
        Map<Long, String> lessonTitles = loadLessonTitles(
                logs.stream().map(ClassLessonLog::getLessonId).filter(Objects::nonNull).distinct().toList());

        return logs.stream()
                .map(log -> toDto(log, byLog.getOrDefault(log.getId(), List.of()), users, lessonTitles))
                .toList();
    }

    @Transactional
    public ClassLessonLogDto createLog(Long teacherId, Long classId, CreateLessonLogRequest req) {
        assertTeacherOwnsClass(teacherId, classId);
        String lessonTitle = validateLessonInClass(classId, req.lessonId());

        ClassLessonLog log = ClassLessonLog.builder()
                .classId(classId)
                .lessonId(req.lessonId())
                .sessionDate(req.sessionDate())
                .sessionNumber(req.sessionNumber())
                .topic(req.topic())
                .homework(req.homework())
                .note(req.note())
                .createdBy(teacherId)
                .build();
        log = lessonLogRepository.save(log);

        List<ClassAttendance> attendances = buildAttendance(log.getId(), req);
        attendanceRepository.saveAll(attendances);

        List<Long> studentIds = attendances.stream().map(a -> a.getId().getStudentId()).toList();
        Map<Long, User> users = studentIds.isEmpty() ? Map.of()
                : userRepository.findAllById(studentIds).stream()
                        .collect(Collectors.toMap(User::getId, u -> u));

        return toDto(log, attendances, users, titleMap(req.lessonId(), lessonTitle));
    }

    @Transactional
    public ClassLessonLogDto updateLog(Long teacherId, Long classId, Long logId, CreateLessonLogRequest req) {
        assertTeacherOwnsClass(teacherId, classId);
        ClassLessonLog log = lessonLogRepository.findById(logId)
                .orElseThrow(() -> new NotFoundException("Buổi học không tồn tại"));
        if (!log.getClassId().equals(classId)) throw new ForbiddenException("Buổi học không thuộc lớp này");
        String lessonTitle = validateLessonInClass(classId, req.lessonId());

        log.setLessonId(req.lessonId());
        log.setSessionDate(req.sessionDate());
        log.setSessionNumber(req.sessionNumber());
        log.setTopic(req.topic());
        log.setHomework(req.homework());
        log.setNote(req.note());
        log = lessonLogRepository.save(log);

        attendanceRepository.deleteByIdLessonLogId(logId);
        List<ClassAttendance> attendances = buildAttendance(log.getId(), req);
        attendanceRepository.saveAll(attendances);

        List<Long> studentIds = attendances.stream().map(a -> a.getId().getStudentId()).toList();
        Map<Long, User> users = studentIds.isEmpty() ? Map.of()
                : userRepository.findAllById(studentIds).stream()
                        .collect(Collectors.toMap(User::getId, u -> u));

        return toDto(log, attendances, users, titleMap(req.lessonId(), lessonTitle));
    }

    @Transactional
    public void deleteLog(Long teacherId, Long classId, Long logId) {
        assertTeacherOwnsClass(teacherId, classId);
        ClassLessonLog log = lessonLogRepository.findById(logId)
                .orElseThrow(() -> new NotFoundException("Buổi học không tồn tại"));
        if (!log.getClassId().equals(classId)) throw new ForbiddenException("Buổi học không thuộc lớp này");
        attendanceRepository.deleteByIdLessonLogId(logId);
        lessonLogRepository.delete(log);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private void assertTeacherOwnsClass(Long teacherId, Long classId) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ForbiddenException("Bạn không có quyền truy cập lớp này");
        }
    }

    /** If lessonId is set, verify it belongs to this class (reject cross-class) and return its title. */
    private String validateLessonInClass(Long classId, Long lessonId) {
        if (lessonId == null) return null;
        ClassLesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new NotFoundException("Bài học không tồn tại"));
        if (!lesson.getClassId().equals(classId)) {
            throw new ForbiddenException("Bài học không thuộc lớp này");
        }
        return lesson.getTitle();
    }

    private Map<Long, String> titleMap(Long lessonId, String title) {
        return (lessonId != null && title != null) ? Map.of(lessonId, title) : Map.of();
    }

    private Map<Long, String> loadLessonTitles(List<Long> lessonIds) {
        if (lessonIds.isEmpty()) return Map.of();
        return lessonRepository.findAllById(lessonIds).stream()
                .collect(Collectors.toMap(ClassLesson::getId, ClassLesson::getTitle));
    }

    /** The only attendance values that may be stored. Anything else is a client bug, not a default. */
    private static final Set<String> ATTENDANCE_STATUSES = Set.of("PRESENT", "LATE", "ABSENT");

    /**
     * Builds the attendance rows for a log. A student the caller did not send is simply not recorded —
     * "no row" means "not marked", which is what the certificate/attendance-rate maths needs to be able
     * to tell apart from "present".
     *
     * <p>A missing or unknown status is rejected rather than defaulted. It used to fall back to PRESENT,
     * which is how a caller that omitted the field could silently mark a student present.
     */
    private List<ClassAttendance> buildAttendance(Long logId, CreateLessonLogRequest req) {
        if (req.attendance() == null) return List.of();
        List<ClassAttendance> list = new ArrayList<>();
        for (CreateLessonLogRequest.AttendanceInput input : req.attendance()) {
            // Null-check first: Set.of(...) is an immutable set, and its contains(null) throws NPE.
            String status = input.status() == null ? null : input.status().toUpperCase();
            if (status == null || !ATTENDANCE_STATUSES.contains(status)) {
                throw new BadRequestException(
                        "Trạng thái điểm danh không hợp lệ cho học viên #" + input.studentId()
                                + " (chỉ nhận PRESENT, LATE, ABSENT).");
            }
            list.add(ClassAttendance.builder()
                    .id(new ClassAttendanceId(logId, input.studentId()))
                    .status(status)
                    .note(input.note())
                    .build());
        }
        return list;
    }

    private ClassLessonLogDto toDto(ClassLessonLog log, List<ClassAttendance> attendances,
                                    Map<Long, User> users, Map<Long, String> lessonTitles) {
        List<ClassLessonLogDto.AttendanceEntry> entries = attendances.stream().map(a -> {
            User u = users.get(a.getId().getStudentId());
            return new ClassLessonLogDto.AttendanceEntry(
                    a.getId().getStudentId(),
                    u != null ? u.getDisplayName() : "Học viên #" + a.getId().getStudentId(),
                    u != null ? u.getEmail() : "",
                    a.getStatus(),
                    a.getNote());
        }).toList();

        String lessonTitle = log.getLessonId() != null ? lessonTitles.get(log.getLessonId()) : null;
        return new ClassLessonLogDto(
                log.getId(), log.getClassId(), log.getSessionDate(), log.getSessionNumber(),
                log.getTopic(), log.getHomework(), log.getNote(), log.getCreatedAt(), entries,
                log.getLessonId(), lessonTitle);
    }
}
