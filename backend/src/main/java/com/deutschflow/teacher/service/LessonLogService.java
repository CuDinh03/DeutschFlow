package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.quota.QuotaVnCalendar;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.dto.ClassLessonLogDto;
import com.deutschflow.teacher.dto.CreateLessonLogRequest;
import com.deutschflow.teacher.entity.ClassAttendance;
import com.deutschflow.teacher.entity.ClassAttendanceId;
import com.deutschflow.teacher.entity.ClassLesson;
import com.deutschflow.teacher.entity.ClassLessonLog;
import com.deutschflow.teacher.entity.ClassSession;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassAttendanceRepository;
import com.deutschflow.teacher.repository.ClassLessonLogRepository;
import com.deutschflow.teacher.repository.ClassLessonRepository;
import com.deutschflow.teacher.repository.ClassSessionRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
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
    private final RecordEditGuard recordEditGuard;
    private final ClassTeacherRepository classTeacherRepository;
    private final ClassStudentRepository classStudentRepository;
    private final ClassLessonRepository lessonRepository;
    private final UserRepository userRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final ClassSessionRepository classSessionRepository;

    @Transactional(readOnly = true)
    public List<ClassLessonLogDto> getLogs(Long teacherId, Long classId) {
        assertTeacherOwnsClass(teacherId, classId);
        return readLogs(classId);
    }

    /**
     * M-17 (G-3): nhật ký buổi dạy cho org-admin (OWNER/MANAGER) — read-only, verify lớp thuộc
     * đúng org của caller. Lớp org khác trả NotFound (không lộ tồn tại, chuẩn tenant-isolation).
     */
    @Transactional(readOnly = true)
    public List<ClassLessonLogDto> getLogsForOrg(Long orgId, Long classId) {
        assertClassInOrg(orgId, classId);
        return readLogs(classId);
    }

    private void assertClassInOrg(Long orgId, Long classId) {
        TeacherClass tc = teacherClassRepository.findById(classId)
                .orElseThrow(() -> new NotFoundException("Lớp học không tồn tại"));
        if (!orgId.equals(tc.getOrgId())) {
            throw new NotFoundException("Lớp học không tồn tại");
        }
    }

    private List<ClassLessonLogDto> readLogs(Long classId) {
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
        Long sessionId = resolveSession(classId, req);
        assertRecordableSession(classId, req, sessionId, null);
        ClassLesson lesson = validateLessonInClass(classId, req.lessonId());

        ClassLessonLog log = ClassLessonLog.builder()
                .classId(classId)
                .lessonId(req.lessonId())
                .sessionId(sessionId)
                .sessionDate(req.sessionDate())
                .sessionNumber(req.sessionNumber())
                .topic(req.topic())
                .homework(req.homework())
                .note(req.note())
                .createdBy(teacherId)
                .build();
        log = lessonLogRepository.save(log);

        // Writing a session log FOR a lesson means the lesson was taught, so mark it completed. Otherwise
        // the teacher records "đã dạy Lektion 3" here and still has to go tick the same lesson in
        // tc-checklist for tc-progress to advance — the same event entered twice, and the two screens
        // disagree if they forget one. Un-ticking stays available in tc-checklist.
        autoCompleteLesson(lesson, teacherId, req.sessionDate());

        List<ClassAttendance> attendances = buildAttendance(log.getId(), req, rosterIds(classId));
        attendanceRepository.saveAll(attendances);

        List<Long> studentIds = attendances.stream().map(a -> a.getId().getStudentId()).toList();
        Map<Long, User> users = studentIds.isEmpty() ? Map.of()
                : userRepository.findAllById(studentIds).stream()
                        .collect(Collectors.toMap(User::getId, u -> u));

        return toDto(log, attendances, users, titleMap(req.lessonId(), lesson == null ? null : lesson.getTitle()));
    }

    /**
     * Marks a lesson completed when a session log is recorded for it — completedAt from the session date.
     * No-op if the lesson is null or already completed, so re-editing a log never re-stamps the date.
     *
     * <p>PR-4 (AC07): bài SINH TỪ GIÁO TRÌNH ({@code lektionId != null}) KHÔNG auto-complete từ
     * nhật ký nữa — Lektion chỉ hoàn thành khi MỌI mục bắt buộc được xác nhận đã dạy
     * (SessionContentService.recomputeLessonCompletion). Bài tự do/lớp không gắn giáo trình giữ
     * nguyên tiện lợi cũ.
     */
    private void autoCompleteLesson(ClassLesson lesson, Long teacherId, java.time.LocalDate sessionDate) {
        if (lesson == null || lesson.getLektionId() != null || lesson.isCompleted()) return;
        lesson.setCompleted(true);
        lesson.setCompletedAt(sessionDate != null ? sessionDate.atStartOfDay() : java.time.LocalDateTime.now());
        lesson.setCompletedByTeacherId(teacherId);
        lessonRepository.save(lesson);
    }

    @Transactional
    public ClassLessonLogDto updateLog(Long teacherId, Long classId, Long logId, CreateLessonLogRequest req) {
        assertTeacherOwnsClass(teacherId, classId);
        ClassLessonLog log = lessonLogRepository.findById(logId)
                .orElseThrow(() -> new NotFoundException("Buổi học không tồn tại"));
        if (!log.getClassId().equals(classId)) throw new ForbiddenException("Buổi học không thuộc lớp này");
        // P07: sửa nhật ký của buổi quá cửa sổ 7 ngày cần mở khóa của người duyệt học vụ.
        recordEditGuard.assertEditable(classId, teacherId, log.getSessionId(), logAnchor(log));
        List<ClassAttendance> beforeAttendance = attendanceRepository.findByIdLessonLogId(logId);
        Map<String, Object> before = revisionSnapshot(log, beforeAttendance);

        Long sessionId = resolveSession(classId, req);
        assertRecordableSession(classId, req, sessionId, logId);
        ClassLesson lesson = validateLessonInClass(classId, req.lessonId());

        log.setLessonId(req.lessonId());
        log.setSessionId(sessionId);
        log.setSessionDate(req.sessionDate());
        log.setSessionNumber(req.sessionNumber());
        log.setTopic(req.topic());
        log.setHomework(req.homework());
        log.setNote(req.note());
        log = lessonLogRepository.save(log);

        // Re-tagging a log to a lesson also marks that lesson taught. (Not un-completing on a change: the
        // teacher can un-tick in tc-checklist, and un-completing silently on edit would be surprising.)
        autoCompleteLesson(lesson, teacherId, req.sessionDate());

        // Danh sách học viên hợp lệ = đang trong lớp ∪ đã có điểm danh trên CHÍNH log này.
        // Vế sau là cố ý: giao diện gửi lại điểm danh của học viên đã rời lớp để việc sửa nhật ký
        // không xoá mất lịch sử của họ (xem `preserved` trong AttendanceTab.tsx). Phải đọc TRƯỚC khi xoá.
        Set<Long> allowed = new HashSet<>(rosterIds(classId));
        attendanceRepository.findByIdLessonLogId(logId)
                .forEach(a -> allowed.add(a.getId().getStudentId()));

        // Dựng (và validate) TRƯỚC khi xoá: một request bị từ chối không được phép xoá trắng điểm danh cũ.
        List<ClassAttendance> attendances = buildAttendance(log.getId(), req, allowed);

        attendanceRepository.deleteByIdLessonLogId(logId);
        // Ép DELETE xuống DB trước khi INSERT lại CÙNG khoá chính (lesson_log_id, student_id).
        // deleteByIdLessonLogId chỉ em.remove() vào ActionQueue; không flush thì Hibernate có thể
        // xếp INSERT trước DELETE và vỡ khoá chính đúng ở ca phổ biến nhất — sửa nhật ký mà giữ
        // nguyên sĩ số.
        attendanceRepository.flush();
        attendanceRepository.saveAll(attendances);

        // P07: mọi lần sửa để lại bản chụp before/after — lịch sử append-only.
        recordEditGuard.revise(com.deutschflow.teacher.entity.ClassRecordRevision.EntityType.LESSON_LOG,
                log.getId(), classId, log.getSessionId(), teacherId, req.editReason(),
                before, revisionSnapshot(log, attendances));

        List<Long> studentIds = attendances.stream().map(a -> a.getId().getStudentId()).toList();
        Map<Long, User> users = studentIds.isEmpty() ? Map.of()
                : userRepository.findAllById(studentIds).stream()
                        .collect(Collectors.toMap(User::getId, u -> u));

        return toDto(log, attendances, users, titleMap(req.lessonId(), lesson == null ? null : lesson.getTitle()));
    }

    @Transactional
    public void deleteLog(Long teacherId, Long classId, Long logId) {
        assertTeacherOwnsClass(teacherId, classId);
        ClassLessonLog log = lessonLogRepository.findById(logId)
                .orElseThrow(() -> new NotFoundException("Buổi học không tồn tại"));
        if (!log.getClassId().equals(classId)) throw new ForbiddenException("Buổi học không thuộc lớp này");
        // P07: xoá nhật ký quá cửa sổ cũng cần mở khóa; bản chụp cuối được giữ lại trong lịch sử.
        recordEditGuard.assertEditable(classId, teacherId, log.getSessionId(), logAnchor(log));
        Map<String, Object> before = revisionSnapshot(log, attendanceRepository.findByIdLessonLogId(logId));
        attendanceRepository.deleteByIdLessonLogId(logId);
        lessonLogRepository.delete(log);
        recordEditGuard.revise(com.deutschflow.teacher.entity.ClassRecordRevision.EntityType.LESSON_LOG,
                logId, classId, log.getSessionId(), teacherId, null, before, null);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    /**
     * Nhật ký buổi dạy là căn cứ tính công giáo viên, nên hai điều kiện dưới đây là ràng buộc
     * tài chính chứ không chỉ là gọt giũa dữ liệu:
     *
     * <ul>
     *   <li><b>Không ghi cho ngày tương lai</b> — nếu không, giáo viên ghi công cho buổi chưa dạy.</li>
     *   <li><b>Không trùng buổi</b> — bấm Lưu hai lần (double-click / mạng chập) sẽ thành hai bản
     *       ghi cho cùng một buổi, tức trả thừa công. Chốt ở tầng service chặn được ngay mà không
     *       cần unique index; index ở tầng DB vẫn nên bổ sung sau khi dọn dữ liệu trùng có sẵn.</li>
     * </ul>
     *
     * @param selfLogId bản ghi đang sửa (bỏ qua khi so trùng); null khi tạo mới.
     */
    private void assertRecordableSession(Long classId, CreateLessonLogRequest req, Long resolvedSessionId,
                                         Long selfLogId) {
        LocalDate sessionDate = req.sessionDate();
        if (sessionDate == null) {
            throw new BadRequestException("Thiếu ngày của buổi học.");
        }
        LocalDate today = LocalDate.now(QuotaVnCalendar.ZONE);
        if (sessionDate.isAfter(today)) {
            throw new BadRequestException(
                    "Không thể ghi nhật ký cho buổi chưa diễn ra (" + sessionDate + ").");
        }
        // PR-4 (AC05): nhật ký gắn buổi chốt trùng THEO BUỔI (1 nhật ký / buổi) — hai buổi
        // sáng/chiều cùng ngày là hai bản ghi hợp lệ. Nhóm legacy (không buổi) giữ luật (ngày, số
        // buổi) cũ, và chỉ so trong chính nhóm legacy để log-gắn-buổi cùng ngày không chặn oan.
        if (resolvedSessionId != null) {
            boolean taken = lessonLogRepository.findBySessionId(resolvedSessionId).stream()
                    .anyMatch(existing -> !existing.getId().equals(selfLogId));
            if (taken) {
                throw new ConflictException(
                        "Buổi này đã có nhật ký. Hãy sửa bản ghi cũ thay vì tạo thêm.");
            }
            return;
        }
        boolean duplicate = lessonLogRepository.findByClassIdAndSessionDate(classId, sessionDate).stream()
                .filter(existing -> existing.getSessionId() == null)
                .filter(existing -> !existing.getId().equals(selfLogId))
                .anyMatch(existing -> Objects.equals(existing.getSessionNumber(), req.sessionNumber()));
        if (duplicate) {
            throw new ConflictException(
                    "Lớp này đã có nhật ký cho buổi ngày " + sessionDate
                            + (req.sessionNumber() != null ? " (buổi " + req.sessionNumber() + ")" : "")
                            + ". Hãy sửa bản ghi cũ thay vì tạo thêm.");
        }
    }

    /**
     * Xác định buổi lịch cho nhật ký (PR-4):
     * <ul>
     *   <li>Client gửi {@code sessionId} → buổi phải thuộc đúng lớp, không phải buổi đã hủy, và
     *       ngày của buổi phải khớp {@code sessionDate} (lệch = 400, không lặng lẽ tin một trong hai).</li>
     *   <li>Không gửi → tự suy theo ngày: lớp không có buổi nào ngày đó = đường legacy (null);
     *       đúng MỘT buổi = tự gắn; TỪ HAI buổi (sáng/chiều — D07) = 400 yêu cầu chọn rõ buổi,
     *       không đoán hộ (AC05).</li>
     * </ul>
     */
    private Long resolveSession(Long classId, CreateLessonLogRequest req) {
        if (req.sessionDate() == null) {
            throw new BadRequestException("Thiếu ngày của buổi học.");
        }
        if (req.sessionId() != null) {
            ClassSession session = classSessionRepository.findById(req.sessionId())
                    .orElseThrow(() -> new NotFoundException("Buổi lịch không tồn tại"));
            if (!session.getClassId().equals(classId)) {
                throw new ForbiddenException("Buổi lịch không thuộc lớp này");
            }
            if (session.getStatus() == ClassSession.Status.CANCELLED) {
                throw new BadRequestException("Buổi đã hủy (nghỉ) — không ghi nhật ký dạy cho buổi này.");
            }
            if (!session.getStartAt().toLocalDate().equals(req.sessionDate())) {
                throw new BadRequestException("Ngày nhật ký (" + req.sessionDate()
                        + ") không khớp ngày của buổi (" + session.getStartAt().toLocalDate() + ").");
            }
            return session.getId();
        }
        List<ClassSession> sameDay = classSessionRepository
                .findByClassIdAndStartAtBetweenOrderByStartAt(classId,
                        req.sessionDate().atStartOfDay(), req.sessionDate().plusDays(1).atStartOfDay())
                .stream()
                .filter(s -> s.getStatus() != ClassSession.Status.CANCELLED)
                .toList();
        if (sameDay.isEmpty()) return null;          // lớp không dùng lịch buổi → đường legacy
        if (sameDay.size() == 1) return sameDay.get(0).getId();
        throw new BadRequestException("Ngày " + req.sessionDate() + " lớp có " + sameDay.size()
                + " buổi (sáng/chiều) — hãy chọn rõ buổi (sessionId) khi ghi nhật ký.");
    }

    private void assertTeacherOwnsClass(Long teacherId, Long classId) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ForbiddenException("Bạn không có quyền truy cập lớp này");
        }
    }

    /** If lessonId is set, verify it belongs to this class (reject cross-class) and return its title. */
    /** Loads the tagged lesson and checks it belongs to the class; null when no lesson is tagged. */
    private ClassLesson validateLessonInClass(Long classId, Long lessonId) {
        if (lessonId == null) return null;
        ClassLesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new NotFoundException("Bài học không tồn tại"));
        if (!lesson.getClassId().equals(classId)) {
            throw new ForbiddenException("Bài học không thuộc lớp này");
        }
        return lesson;
    }

    private Map<Long, String> titleMap(Long lessonId, String title) {
        return (lessonId != null && title != null) ? Map.of(lessonId, title) : Map.of();
    }

    private Map<Long, String> loadLessonTitles(List<Long> lessonIds) {
        if (lessonIds.isEmpty()) return Map.of();
        return lessonRepository.findAllById(lessonIds).stream()
                .collect(Collectors.toMap(ClassLesson::getId, ClassLesson::getTitle));
    }

    /** Mốc thời gian của một nhật ký cho cửa sổ sửa hồi tố (P07): giờ buổi, hoặc ngày với log legacy. */
    private java.time.LocalDateTime logAnchor(ClassLessonLog log) {
        if (log.getSessionId() != null) {
            return classSessionRepository.findById(log.getSessionId())
                    .map(ClassSession::getStartAt)
                    .orElse(log.getSessionDate() != null ? log.getSessionDate().atStartOfDay() : null);
        }
        return log.getSessionDate() != null ? log.getSessionDate().atStartOfDay() : null;
    }

    /** Bản chụp gọn của nhật ký + điểm danh cho lịch sử sửa hồi tố (P07). */
    private Map<String, Object> revisionSnapshot(ClassLessonLog log, List<ClassAttendance> attendances) {
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("sessionDate", String.valueOf(log.getSessionDate()));
        m.put("sessionNumber", log.getSessionNumber());
        m.put("sessionId", log.getSessionId());
        m.put("lessonId", log.getLessonId());
        m.put("topic", log.getTopic());
        m.put("homework", log.getHomework());
        m.put("note", log.getNote());
        m.put("attendance", attendances.stream()
                .map(a -> Map.of(
                        "studentId", a.getId().getStudentId(),
                        "status", a.getStatus(),
                        "needsMakeup", a.isNeedsMakeup()))
                .toList());
        return m;
    }

    /** The only attendance values that may be stored. Anything else is a client bug, not a default. */
    private static final Set<String> ATTENDANCE_STATUSES = Set.of("PRESENT", "LATE", "ABSENT");

    /** Id của học viên đang thuộc lớp. Dùng làm biên cho mọi dòng điểm danh được ghi. */
    private Set<Long> rosterIds(Long classId) {
        return classStudentRepository.findByIdClassId(classId).stream()
                .map(cs -> cs.getId().getStudentId())
                .collect(Collectors.toSet());
    }

    /**
     * Builds the attendance rows for a log. A student the caller did not send is simply not recorded —
     * "no row" means "not marked", which is what the certificate/attendance-rate maths needs to be able
     * to tell apart from "present".
     *
     * <p>A missing or unknown status is rejected rather than defaulted. It used to fall back to PRESENT,
     * which is how a caller that omitted the field could silently mark a student present.
     *
     * <p>{@code allowedStudentIds} giới hạn dòng điểm danh vào đúng học viên của lớp. Trước đây
     * studentId được nhận thẳng từ client: một giáo viên sở hữu bất kỳ lớp nào có thể ghi điểm danh
     * cho id tuỳ ý, và response (kèm displayName + email do toDto tra cứu toàn cục) trở thành kênh
     * liệt kê thông tin cá nhân của mọi người dùng, xuyên tổ chức.
     */
    private List<ClassAttendance> buildAttendance(Long logId, CreateLessonLogRequest req,
                                                  Set<Long> allowedStudentIds) {
        if (req.attendance() == null) return List.of();
        List<ClassAttendance> list = new ArrayList<>();
        Set<Long> seen = new HashSet<>();
        for (CreateLessonLogRequest.AttendanceInput input : req.attendance()) {
            // Null-check first: Set.of(...) is an immutable set, and its contains(null) throws NPE.
            String status = input.status() == null ? null : input.status().toUpperCase();
            if (status == null || !ATTENDANCE_STATUSES.contains(status)) {
                throw new BadRequestException(
                        "Trạng thái điểm danh không hợp lệ cho học viên #" + input.studentId()
                                + " (chỉ nhận PRESENT, LATE, ABSENT).");
            }
            if (input.studentId() == null || !allowedStudentIds.contains(input.studentId())) {
                throw new BadRequestException(
                        "Học viên #" + input.studentId() + " không thuộc lớp này.");
            }
            // Hai dòng cùng studentId mang cùng khoá chính: hàng sau lặng lẽ ghi đè hàng trước, DB
            // lưu 1 hàng nhưng response vẫn liệt kê cả 2 → số liệu điểm danh mơ hồ. Từ chối thẳng.
            if (!seen.add(input.studentId())) {
                throw new BadRequestException(
                        "Học viên #" + input.studentId() + " xuất hiện nhiều lần trong danh sách điểm danh.");
            }
            list.add(ClassAttendance.builder()
                    .id(new ClassAttendanceId(logId, input.studentId()))
                    .status(status)
                    .note(input.note())
                    // AC13: vắng mặc định mang cờ "cần bù riêng"; giáo viên gửi tường minh để bỏ/đặt lại.
                    .needsMakeup(input.needsMakeup() != null ? input.needsMakeup() : "ABSENT".equals(status))
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
                    a.getNote(),
                    a.isNeedsMakeup());
        }).toList();

        String lessonTitle = log.getLessonId() != null ? lessonTitles.get(log.getLessonId()) : null;
        return new ClassLessonLogDto(
                log.getId(), log.getClassId(), log.getSessionDate(), log.getSessionNumber(),
                log.getTopic(), log.getHomework(), log.getNote(), log.getCreatedAt(), entries,
                log.getLessonId(), lessonTitle, log.getSessionId());
    }
}
