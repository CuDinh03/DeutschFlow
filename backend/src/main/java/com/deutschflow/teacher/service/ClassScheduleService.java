package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.dto.*;
import com.deutschflow.teacher.entity.ClassSchedulePattern;
import com.deutschflow.teacher.entity.ClassSession;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassSchedulePatternRepository;
import com.deutschflow.teacher.repository.ClassSessionRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Lịch buổi lớp (Pha 2). Pattern định kỳ sinh ra các buổi cụ thể; mỗi buổi sửa được.
 * <ul>
 *   <li>Override sticky (PO #1): regenerate KHÔNG ghi đè buổi đã chỉnh tay.</li>
 *   <li>Cảnh báo mềm trùng phòng (PO #2): {@link #roomWarnings} không chặn lưu.</li>
 * </ul>
 * Mọi endpoint kiểm tra giáo viên thực sự dạy lớp (chống IDOR) — cùng pattern với
 * {@code StudentEvaluationService}.
 */
@Service
@RequiredArgsConstructor
public class ClassScheduleService {

    /** Sinh buổi trước N tuần khi pattern không có ngày kết thúc (effective_to = null). */
    private static final int GENERATE_WEEKS = 12;
    private static final DateTimeFormatter WARN_FMT = DateTimeFormatter.ofPattern("dd/MM HH:mm");

    private final ClassSchedulePatternRepository patternRepo;
    private final ClassSessionRepository sessionRepo;
    private final TeacherClassRepository classRepo;
    private final ClassStudentRepository classStudentRepo;
    private final ClassTeacherRepository classTeacherRepo;

    // ── Đọc ──────────────────────────────────────────────────────────────────

    /** Lịch tuần buổi lớp của một giáo viên: gộp mọi lớp GV dạy trong [from, to]. */
    @Transactional(readOnly = true)
    public List<ClassSessionDto> weekForTeacher(Long teacherId, LocalDateTime from, LocalDateTime to) {
        if (from == null || to == null || to.isBefore(from)) {
            throw new BadRequestException("Khoảng thời gian không hợp lệ");
        }
        List<Long> classIds = classTeacherRepo.findByIdTeacherId(teacherId).stream()
                .map(ct -> ct.getId().getClassId())
                .distinct()
                .toList();
        if (classIds.isEmpty()) return List.of();

        List<ClassSession> sessions = sessionRepo.findForClassesInRange(classIds, from, to);
        if (sessions.isEmpty()) return List.of();

        Map<Long, String> names = classNameMap(classIds);
        Map<Long, Integer> counts = studentCountMap(classIds);
        return sessions.stream().map(s -> toDto(s, names, counts)).toList();
    }

    /**
     * Lịch tuần buổi lớp TOÀN tổ chức (G-3) — đọc-chỉ cho org-admin (OWNER/MANAGER).
     * Org-scoped theo orgId (lấy từ principal ở controller), KHÔNG theo teacher-ownership;
     * tái dùng cùng truy vấn + DTO với {@link #weekForTeacher}.
     */
    @Transactional(readOnly = true)
    public List<ClassSessionDto> weekForOrg(Long orgId, LocalDateTime from, LocalDateTime to) {
        if (from == null || to == null || to.isBefore(from)) {
            throw new BadRequestException("Khoảng thời gian không hợp lệ");
        }
        List<Long> classIds = classRepo.findByOrgId(orgId).stream()
                .map(TeacherClass::getId)
                .toList();
        if (classIds.isEmpty()) return List.of();

        List<ClassSession> sessions = sessionRepo.findForClassesInRange(classIds, from, to);
        if (sessions.isEmpty()) return List.of();

        Map<Long, String> names = classNameMap(classIds);
        Map<Long, Integer> counts = studentCountMap(classIds);
        return sessions.stream().map(s -> toDto(s, names, counts)).toList();
    }

    /** Lịch cố định của một lớp (một dòng mỗi thứ). */
    @Transactional(readOnly = true)
    public List<ClassSchedulePatternDto> patternsForClass(Long teacherId, Long classId) {
        assertTeacherOwnsClass(teacherId, classId);
        return patternRepo.findByClassIdOrderByDayOfWeekAscStartTimeAsc(classId).stream()
                .map(this::toPatternDto)
                .toList();
    }

    // ── Ghi ──────────────────────────────────────────────────────────────────

    /**
     * Đặt/đổi lịch cố định cho một thứ của lớp + regenerate buổi tương lai CHƯA override.
     * Upsert theo (classId, dayOfWeek). Giữ nguyên buổi đã chỉnh tay (override sticky).
     */
    @Transactional
    public UpsertPatternResult upsertPattern(Long teacherId, Long classId, UpsertPatternRequest req) {
        assertTeacherOwnsClass(teacherId, classId);
        validatePatternReq(req);

        ClassSchedulePattern pattern = patternRepo.findByClassIdAndDayOfWeek(classId, req.dayOfWeek())
                .stream().findFirst().orElseGet(ClassSchedulePattern::new);
        pattern.setClassId(classId);
        pattern.setDayOfWeek(req.dayOfWeek());
        pattern.setStartTime(req.startTime());
        pattern.setDurationMinutes(req.durationMinutes());
        pattern.setDefaultMode(parsePatternMode(req.defaultMode()));
        pattern.setDefaultRoom(req.defaultRoom());
        pattern.setEffectiveFrom(req.effectiveFrom());
        pattern.setEffectiveTo(req.effectiveTo());
        pattern = patternRepo.save(pattern);

        Regen regen = regenerate(pattern);
        return new UpsertPatternResult(pattern.getId(), regen.generated(), regen.kept());
    }

    /** Sửa một buổi → đánh dấu overridden=true; trả cảnh báo mềm nếu trùng phòng. */
    @Transactional
    public SessionSaveResult updateSession(Long teacherId, Long sessionId, UpdateSessionRequest req) {
        ClassSession s = sessionRepo.findById(sessionId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy buổi học"));
        assertTeacherOwnsClass(teacherId, s.getClassId());

        if (req.startAt() != null) s.setStartAt(req.startAt());
        if (req.durationMinutes() != null) {
            if (req.durationMinutes() <= 0) throw new BadRequestException("Thời lượng phải lớn hơn 0");
            s.setDurationMinutes(req.durationMinutes());
        }
        if (req.mode() != null) s.setMode(parseSessionMode(req.mode()));
        if (req.status() != null) s.setStatus(parseStatus(req.status()));
        // SCH-1: nếu PATCH chỉ set status=CANCELLED mà không gửi room → giữ nguyên phòng cũ
        if (!"CANCELLED".equalsIgnoreCase(req.status()) || req.room() != null) s.setRoom(req.room());
        if (s.getMode() == ClassSession.Mode.ONLINE) s.setRoom(null);
        s.setOverridden(true);                                   // PO #1: chỉnh tay → sticky
        sessionRepo.save(s);

        return new SessionSaveResult(toDto(s), roomWarnings(s));
    }

    /** Thêm một buổi lớp lẻ (không theo pattern). Buổi tạo tay được đánh dấu overridden. */
    @Transactional
    public SessionSaveResult createSession(Long teacherId, Long classId, CreateSessionRequest req) {
        assertTeacherOwnsClass(teacherId, classId);
        if (req.startAt() == null) throw new BadRequestException("Thiếu thời gian bắt đầu");
        if (req.durationMinutes() <= 0) throw new BadRequestException("Thời lượng phải lớn hơn 0");

        ClassSession.Mode mode = parseSessionMode(req.mode());
        ClassSession s = ClassSession.builder()
                .classId(classId)
                .startAt(req.startAt())
                .durationMinutes(req.durationMinutes())
                .mode(mode)
                .room(mode == ClassSession.Mode.ONLINE ? null : req.room())
                .status(ClassSession.Status.SCHEDULED)
                .overridden(true)
                .build();
        s = sessionRepo.save(s);
        return new SessionSaveResult(toDto(s), roomWarnings(s));
    }

    /** Xoá lịch cố định + buổi tương lai CHƯA override; buổi đã chỉnh tay được giữ (FK SET NULL). */
    @Transactional
    public int deletePattern(Long teacherId, Long patternId) {
        ClassSchedulePattern p = patternRepo.findById(patternId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy lịch cố định"));
        assertTeacherOwnsClass(teacherId, p.getClassId());

        List<ClassSession> future = sessionRepo.findByPatternIdAndStartAtGreaterThanEqual(
                patternId, LocalDate.now().atStartOfDay());
        List<ClassSession> removable = future.stream().filter(s -> !s.isOverridden()).toList();
        sessionRepo.deleteAll(removable);
        patternRepo.delete(p);   // ON DELETE SET NULL gỡ buổi override khỏi pattern
        return removable.size();
    }

    // ── Regenerate ─────────────────────────────────────────────────────────────

    private Regen regenerate(ClassSchedulePattern p) {
        LocalDate today = LocalDate.now();
        List<ClassSession> future = sessionRepo.findByPatternIdAndStartAtGreaterThanEqual(
                p.getId(), today.atStartOfDay());

        List<ClassSession> stale = future.stream().filter(s -> !s.isOverridden()).toList();
        sessionRepo.deleteAll(stale);

        Set<LocalDate> keptDates = future.stream()
                .filter(ClassSession::isOverridden)
                .map(s -> s.getStartAt().toLocalDate())
                .collect(Collectors.toSet());

        LocalDate genStart = today.isAfter(p.getEffectiveFrom()) ? today : p.getEffectiveFrom();
        LocalDate genEnd = p.getEffectiveTo() != null ? p.getEffectiveTo() : genStart.plusWeeks(GENERATE_WEEKS);

        ClassSession.Mode mode = p.getDefaultMode() == ClassSchedulePattern.Mode.ONLINE
                ? ClassSession.Mode.ONLINE : ClassSession.Mode.OFFLINE;

        List<ClassSession> created = new ArrayList<>();
        for (LocalDate d = genStart; !d.isAfter(genEnd); d = d.plusDays(1)) {
            if (toPatternDow(d) != p.getDayOfWeek()) continue;
            if (keptDates.contains(d)) continue;                 // buổi override đã chiếm chỗ
            created.add(ClassSession.builder()
                    .classId(p.getClassId())
                    .patternId(p.getId())
                    .startAt(d.atTime(p.getStartTime()))
                    .durationMinutes(p.getDurationMinutes())
                    .mode(mode)
                    .room(mode == ClassSession.Mode.ONLINE ? null : p.getDefaultRoom())
                    .status(ClassSession.Status.SCHEDULED)
                    .overridden(false)
                    .build());
        }
        sessionRepo.saveAll(created);
        return new Regen(created.size(), keptDates.size());
    }

    private record Regen(int generated, int kept) {}

    // ── Cảnh báo trùng phòng (mềm) ──────────────────────────────────────────────

    private List<String> roomWarnings(ClassSession s) {
        if (s.getRoom() == null
                || s.getMode() == ClassSession.Mode.ONLINE
                || s.getStatus() != ClassSession.Status.SCHEDULED) {
            return List.of();
        }
        LocalDateTime end = s.getStartAt().plusMinutes(s.getDurationMinutes());
        return sessionRepo.findRoomConflicts(s.getRoom(), s.getStartAt(), end, s.getId()).stream()
                .map(c -> "Phòng " + s.getRoom() + " trùng với buổi #" + c.getId()
                        + " lúc " + WARN_FMT.format(c.getStartAt()))
                .toList();
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    private void assertTeacherOwnsClass(Long teacherId, Long classId) {
        if (!classTeacherRepo.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ForbiddenException("Bạn không có quyền truy cập lớp này");
        }
    }

    private Map<Long, String> classNameMap(List<Long> classIds) {
        return classRepo.findAllById(classIds).stream()
                .collect(Collectors.toMap(TeacherClass::getId, TeacherClass::getName));
    }

    private Map<Long, Integer> studentCountMap(List<Long> classIds) {
        Map<Long, Integer> counts = new HashMap<>();
        for (Long id : classIds) counts.put(id, (int) classStudentRepo.countByIdClassId(id));
        return counts;
    }

    /** java DayOfWeek (Mon=1…Sun=7) → ISO 1-7 (quy ước mới từ V240, trước đây 0-6). */
    private static short toPatternDow(LocalDate d) {
        return (short) d.getDayOfWeek().getValue();
    }

    private ClassSessionDto toDto(ClassSession s) {
        String name = classRepo.findById(s.getClassId())
                .map(TeacherClass::getName).orElse("Lớp #" + s.getClassId());
        return toDto(s, name, (int) classStudentRepo.countByIdClassId(s.getClassId()));
    }

    private ClassSessionDto toDto(ClassSession s, Map<Long, String> names, Map<Long, Integer> counts) {
        return toDto(s, names.getOrDefault(s.getClassId(), "Lớp #" + s.getClassId()),
                counts.getOrDefault(s.getClassId(), 0));
    }

    private ClassSessionDto toDto(ClassSession s, String className, int studentCount) {
        return new ClassSessionDto(s.getId(), s.getClassId(), className, s.getPatternId(),
                s.getMode().name(), s.getRoom(), s.getStartAt(), s.getDurationMinutes(),
                s.getStatus().name(), s.isOverridden(), studentCount);
    }

    private ClassSchedulePatternDto toPatternDto(ClassSchedulePattern p) {
        return new ClassSchedulePatternDto(p.getId(), p.getClassId(), p.getDayOfWeek(),
                p.getStartTime(), p.getDurationMinutes(), p.getDefaultMode().name(),
                p.getDefaultRoom(), p.getEffectiveFrom(), p.getEffectiveTo());
    }

    private void validatePatternReq(UpsertPatternRequest req) {
        if (req.dayOfWeek() < 1 || req.dayOfWeek() > 7) throw new BadRequestException("Thứ trong tuần không hợp lệ (dùng ISO 1–7: 1=Thứ 2, 7=Chủ nhật)");
        if (req.startTime() == null) throw new BadRequestException("Thiếu giờ bắt đầu");
        if (req.durationMinutes() <= 0) throw new BadRequestException("Thời lượng phải lớn hơn 0");
        if (req.effectiveFrom() == null) throw new BadRequestException("Thiếu ngày bắt đầu áp dụng");
        if (req.effectiveTo() != null && req.effectiveTo().isBefore(req.effectiveFrom())) {
            throw new BadRequestException("Ngày kết thúc phải sau ngày bắt đầu");
        }
    }

    private ClassSession.Mode parseSessionMode(String v) {
        if (v == null) return ClassSession.Mode.OFFLINE;
        try {
            return ClassSession.Mode.valueOf(v.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Hình thức không hợp lệ: " + v);
        }
    }

    private ClassSession.Status parseStatus(String v) {
        try {
            return ClassSession.Status.valueOf(v.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Trạng thái không hợp lệ: " + v);
        }
    }

    private ClassSchedulePattern.Mode parsePatternMode(String v) {
        if (v == null) return ClassSchedulePattern.Mode.OFFLINE;
        try {
            return ClassSchedulePattern.Mode.valueOf(v.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Hình thức không hợp lệ: " + v);
        }
    }
}
