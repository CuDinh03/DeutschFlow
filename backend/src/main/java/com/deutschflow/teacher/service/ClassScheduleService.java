package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.teacher.dto.*;
import com.deutschflow.teacher.entity.ClassSchedulePattern;
import com.deutschflow.teacher.entity.ClassSession;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassSchedulePatternRepository;
import com.deutschflow.teacher.repository.ClassSessionRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.deutschflow.common.quota.QuotaVnCalendar;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
@lombok.extern.slf4j.Slf4j
public class ClassScheduleService {

    /** Sinh buổi trước N tuần khi pattern không có ngày kết thúc (effective_to = null). */
    private static final int GENERATE_WEEKS = 12;
    private static final DateTimeFormatter WARN_FMT = DateTimeFormatter.ofPattern("dd/MM HH:mm");
    /** Định dạng đầy đủ cho thông báo gửi học viên. */
    private static final DateTimeFormatter WHEN_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy 'lúc' HH:mm");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    /** Nhãn thứ theo ISO 1–7 (index 0 bỏ trống): 1=Thứ 2 … 7=Chủ nhật. */
    private static final String[] DOW_VN = {"", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"};

    private final ClassSchedulePatternRepository patternRepo;
    private final ClassSessionRepository sessionRepo;
    private final TeacherClassRepository classRepo;
    private final ClassStudentRepository classStudentRepo;
    private final ClassTeacherRepository classTeacherRepo;
    private final UserNotificationService notificationService;

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
     *
     * <p>Chống trùng lịch giáo viên (PR #190) nay theo hướng BỎ QUA thay vì CHẶN CỨNG cả pattern:
     * những buổi sắp sinh trùng giờ với lớp KHÁC mà giáo viên cũng dạy sẽ bị bỏ qua (không tạo →
     * không bao giờ có chuyện dạy hai nơi cùng lúc), còn các ngày trống vẫn được sinh bình thường.
     * Nhờ vậy một ngày kẹt không khoá toàn bộ lịch; FE báo "bỏ qua Y buổi trùng lịch".</p>
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

        // Những ngày trùng lịch dạy của giáo viên (ở lớp khác) — sẽ bị bỏ qua khi regenerate.
        Set<LocalDate> conflictDates = findTeacherConflictDates(teacherId, classId, pattern);

        pattern = patternRepo.save(pattern);

        Regen regen = regenerate(pattern, conflictDates);

        // Chỉ báo học viên khi thực sự có buổi được sinh — tránh "có lịch học cố định" khi mọi ngày
        // đều bị bỏ qua do trùng lịch (khi đó chỉ mình giáo viên thấy cảnh báo ở FE).
        if (regen.generated() > 0) {
            String name = className(classId);
            String message = "Lớp " + name + " có lịch học cố định: "
                    + dowLabel(pattern.getDayOfWeek()) + " hàng tuần lúc " + pattern.getStartTime()
                    + " (" + pattern.getDurationMinutes() + " phút), áp dụng từ "
                    + DATE_FMT.format(pattern.getEffectiveFrom()) + ".";
            notificationService.notifyClassScheduleEvent(
                    NotificationType.CLASS_SESSION_SCHEDULED, classId, name, teacherId, message);
        }

        return new UpsertPatternResult(pattern.getId(), regen.generated(), regen.kept(), regen.skipped());
    }

    /** Sửa một buổi → đánh dấu overridden=true; trả cảnh báo mềm nếu trùng phòng. */
    @Transactional
    public SessionSaveResult updateSession(Long teacherId, Long sessionId, UpdateSessionRequest req) {
        ClassSession s = sessionRepo.findById(sessionId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy buổi học"));
        assertTeacherOwnsClass(teacherId, s.getClassId());

        LocalDateTime oldStart = s.getStartAt();
        int oldDuration = s.getDurationMinutes();
        ClassSession.Mode oldMode = s.getMode();
        String oldRoom = s.getRoom();
        ClassSession.Status oldStatus = s.getStatus();

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

        // Chặn cứng trùng lịch giáo viên khi buổi vẫn còn hiệu lực (SCHEDULED). Buổi bị huỷ/dời
        // không cần chặn vì không chiếm chỗ dạy nữa.
        if (s.getStatus() == ClassSession.Status.SCHEDULED) {
            assertTeacherFree(teacherId, s.getStartAt(), s.getDurationMinutes(), s.getId());
        }
        sessionRepo.save(s);

        notifyOnSessionUpdate(teacherId, s, oldStart, oldDuration, oldMode, oldRoom, oldStatus);

        return new SessionSaveResult(toDto(s), roomWarnings(s));
    }

    /** Thêm một buổi lớp lẻ (không theo pattern). Buổi tạo tay được đánh dấu overridden. */
    @Transactional
    public SessionSaveResult createSession(Long teacherId, Long classId, CreateSessionRequest req) {
        assertTeacherOwnsClass(teacherId, classId);
        if (req.startAt() == null) throw new BadRequestException("Thiếu thời gian bắt đầu");
        if (req.durationMinutes() <= 0) throw new BadRequestException("Thời lượng phải lớn hơn 0");

        // Chặn cứng trùng lịch giáo viên trước khi tạo buổi.
        assertTeacherFree(teacherId, req.startAt(), req.durationMinutes(), null);

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

        String name = className(classId);
        notificationService.notifyClassScheduleEvent(
                NotificationType.CLASS_SESSION_SCHEDULED, classId, name, teacherId,
                "Lớp " + name + " có buổi học mới: " + whenWhere(s) + ".");

        return new SessionSaveResult(toDto(s), roomWarnings(s));
    }

    /** Xoá lịch cố định + buổi tương lai CHƯA override; buổi đã chỉnh tay được giữ (FK SET NULL). */
    @Transactional
    public int deletePattern(Long teacherId, Long patternId) {
        ClassSchedulePattern p = patternRepo.findById(patternId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy lịch cố định"));
        assertTeacherOwnsClass(teacherId, p.getClassId());

        // Audit M-9: resolve "today" in VN time (UTC+7), not the container's UTC default — else
        // between 00:00–07:00 VN the boundary day is off by one and a same-day session can be
        // wrongly classified stale/future.
        List<ClassSession> future = sessionRepo.findByPatternIdAndStartAtGreaterThanEqual(
                patternId, LocalDate.now(QuotaVnCalendar.ZONE).atStartOfDay());
        List<ClassSession> removable = future.stream().filter(s -> !s.isOverridden()).toList();
        sessionRepo.deleteAll(removable);
        patternRepo.delete(p);   // ON DELETE SET NULL gỡ buổi override khỏi pattern

        // Chỉ báo học viên khi thực sự có buổi bị gỡ — tránh "thông báo huỷ" khi mọi buổi tương lai
        // đều đã chỉnh tay (được giữ nguyên), tức lịch học viên không đổi.
        if (!removable.isEmpty()) {
            notificationService.notifyClassScheduleEvent(
                    NotificationType.CLASS_SESSION_CANCELLED, p.getClassId(), className(p.getClassId()), teacherId,
                    "Lịch học cố định " + dowLabel(p.getDayOfWeek()) + " của lớp "
                            + className(p.getClassId()) + " đã bị huỷ.");
        }
        return removable.size();
    }

    // ── Regenerate ─────────────────────────────────────────────────────────────

    /**
     * Regenerate buổi tương lai cho pattern. {@code skipDates} là các ngày KHÔNG sinh buổi vì trùng
     * lịch dạy của giáo viên ở lớp khác (được đếm vào {@code skipped} để FE cảnh báo). Buổi đã chỉnh
     * tay (override) luôn được giữ và chiếm chỗ trước cả skip.
     */
    /**
     * Rolls the 12-week session window forward for every pattern still in effect. An open-ended pattern
     * ("để trống = vô thời hạn") only ever generated sessions at upsert time — with no job to extend it,
     * after ~3 months the class silently ran out of sessions and vanished from the weekly grid while the
     * pattern still existed. A daily job keeps the window full. Idempotent: {@link #regenerate} preserves
     * overridden (hand-edited) sessions and only re-creates the plain ones, and never notifies students.
     *
     * @return number of sessions created across all patterns this run.
     */
    @Transactional
    public int rollForwardActivePatterns() {
        LocalDate today = LocalDate.now(QuotaVnCalendar.ZONE);
        List<ClassSchedulePattern> active =
                patternRepo.findByEffectiveToIsNullOrEffectiveToGreaterThanEqual(today);
        int created = 0;
        for (ClassSchedulePattern p : active) {
            try {
                // Skip the same teacher-conflict dates the interactive path skips. Use the class's PRIMARY
                // teacher as the owner for that check; if none is found, just don't skip (empty set).
                Long ownerTeacherId = primaryTeacherOf(p.getClassId());
                Set<LocalDate> skip = ownerTeacherId != null
                        ? findTeacherConflictDates(ownerTeacherId, p.getClassId(), p)
                        : Set.of();
                created += regenerate(p, skip).generated();
            } catch (Exception e) {
                // One bad pattern must not stop the rest of the classes from rolling forward.
                log.warn("[schedule-roll] pattern {} (class {}) failed: {}", p.getId(), p.getClassId(), e.toString());
            }
        }
        return created;
    }

    /** The class's PRIMARY teacher id, or the first teacher, or null when the class has none. */
    private Long primaryTeacherOf(Long classId) {
        List<ClassTeacher> teachers = classTeacherRepo.findByIdClassId(classId);
        return teachers.stream()
                .filter(ct -> "PRIMARY".equals(ct.getRole()))
                .map(ct -> ct.getId().getTeacherId())
                .findFirst()
                .orElseGet(() -> teachers.stream().map(ct -> ct.getId().getTeacherId()).findFirst().orElse(null));
    }

    private Regen regenerate(ClassSchedulePattern p, Set<LocalDate> skipDates) {
        LocalDate today = LocalDate.now(QuotaVnCalendar.ZONE);   // audit M-9: VN time, not UTC
        List<ClassSession> future = sessionRepo.findByPatternIdAndStartAtGreaterThanEqual(
                p.getId(), today.atStartOfDay());

        List<ClassSession> stale = future.stream().filter(s -> !s.isOverridden()).toList();
        sessionRepo.deleteAll(stale);

        Set<LocalDate> keptDates = future.stream()
                .filter(ClassSession::isOverridden)
                .map(s -> s.getStartAt().toLocalDate())
                .collect(Collectors.toSet());

        ClassSession.Mode mode = p.getDefaultMode() == ClassSchedulePattern.Mode.ONLINE
                ? ClassSession.Mode.ONLINE : ClassSession.Mode.OFFLINE;

        int skipped = 0;
        List<ClassSession> created = new ArrayList<>();
        for (LocalDate d : patternOccurrenceDates(p)) {
            if (keptDates.contains(d)) continue;                 // buổi override đã chiếm chỗ
            if (skipDates.contains(d)) { skipped++; continue; } // trùng lịch GV lớp khác → bỏ qua
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
        return new Regen(created.size(), keptDates.size(), skipped);
    }

    /**
     * Các ngày (theo đúng thứ của pattern) mà lịch cố định sẽ sinh buổi: từ max(hôm nay, effectiveFrom)
     * tới effectiveTo (hoặc +{@value #GENERATE_WEEKS} tuần nếu vô thời hạn). Dùng chung cho regenerate
     * và kiểm tra trùng lịch giáo viên để hai bên luôn nhất quán.
     */
    private List<LocalDate> patternOccurrenceDates(ClassSchedulePattern p) {
        LocalDate today = LocalDate.now(QuotaVnCalendar.ZONE);
        LocalDate genStart = today.isAfter(p.getEffectiveFrom()) ? today : p.getEffectiveFrom();
        LocalDate genEnd = p.getEffectiveTo() != null ? p.getEffectiveTo() : genStart.plusWeeks(GENERATE_WEEKS);
        List<LocalDate> out = new ArrayList<>();
        for (LocalDate d = genStart; !d.isAfter(genEnd); d = d.plusDays(1)) {
            if (toPatternDow(d) == p.getDayOfWeek()) out.add(d);
        }
        return out;
    }

    private record Regen(int generated, int kept, int skipped) {}

    // ── Chặn cứng trùng lịch giáo viên ──────────────────────────────────────────

    private List<Long> teacherClassIds(Long teacherId) {
        return classTeacherRepo.findByIdTeacherId(teacherId).stream()
                .map(ct -> ct.getId().getClassId())
                .distinct()
                .toList();
    }

    /** Chặn cứng nếu buổi [start, start+duration) đè lên buổi SCHEDULED khác của cùng giáo viên. */
    private void assertTeacherFree(Long teacherId, LocalDateTime start, int durationMinutes, Long selfSessionId) {
        List<Long> classIds = teacherClassIds(teacherId);
        if (classIds.isEmpty()) return;
        LocalDateTime end = start.plusMinutes(durationMinutes);
        List<ClassSession> conflicts = sessionRepo.findTeacherTimeConflicts(classIds, start, end, selfSessionId);
        if (!conflicts.isEmpty()) throw teacherConflict(conflicts.get(0));
    }

    /**
     * Các ngày (occurrence) mà lịch cố định sắp sinh sẽ ĐÈ lên buổi của lớp KHÁC mà giáo viên cũng
     * dạy — những ngày này bị bỏ qua khi regenerate (không tạo buổi chồng chỗ dạy). Một truy vấn theo
     * cửa sổ [buổi đầu … buổi cuối] rồi đối chiếu overlap chính xác trong bộ nhớ (pattern thưa nên rẻ).
     */
    private Set<LocalDate> findTeacherConflictDates(Long teacherId, Long classId, ClassSchedulePattern pattern) {
        List<LocalDate> dates = patternOccurrenceDates(pattern);
        if (dates.isEmpty()) return Set.of();
        List<Long> otherClassIds = teacherClassIds(teacherId).stream()
                .filter(id -> !id.equals(classId))
                .toList();
        if (otherClassIds.isEmpty()) return Set.of();

        int duration = pattern.getDurationMinutes();
        LocalDateTime windowStart = dates.get(0).atTime(pattern.getStartTime());
        LocalDateTime windowEnd = dates.get(dates.size() - 1).atTime(pattern.getStartTime()).plusMinutes(duration);
        List<ClassSession> others = sessionRepo.findTeacherTimeConflicts(otherClassIds, windowStart, windowEnd, null);
        if (others.isEmpty()) return Set.of();

        Set<LocalDate> conflicts = new HashSet<>();
        for (LocalDate d : dates) {
            LocalDateTime occStart = d.atTime(pattern.getStartTime());
            LocalDateTime occEnd = occStart.plusMinutes(duration);
            for (ClassSession o : others) {
                LocalDateTime oEnd = o.getStartAt().plusMinutes(o.getDurationMinutes());
                if (o.getStartAt().isBefore(occEnd) && occStart.isBefore(oEnd)) {
                    conflicts.add(d);
                    break;
                }
            }
        }
        return conflicts;
    }

    private BadRequestException teacherConflict(ClassSession c) {
        return new BadRequestException(
                "Trùng lịch giáo viên: bạn đã có buổi dạy lớp \"" + className(c.getClassId())
                        + "\" lúc " + WARN_FMT.format(c.getStartAt()) + ". Vui lòng chọn giờ khác.");
    }

    // ── Thông báo học viên khi lịch dạy thay đổi ────────────────────────────────

    private void notifyOnSessionUpdate(Long teacherId, ClassSession s, LocalDateTime oldStart,
                                       int oldDuration, ClassSession.Mode oldMode, String oldRoom,
                                       ClassSession.Status oldStatus) {
        boolean nowCancelled = s.getStatus() == ClassSession.Status.CANCELLED;
        boolean wasCancelled = oldStatus == ClassSession.Status.CANCELLED;
        boolean timeChanged = !Objects.equals(oldStart, s.getStartAt()) || oldDuration != s.getDurationMinutes();
        boolean placeChanged = oldMode != s.getMode() || !Objects.equals(oldRoom, s.getRoom());
        boolean statusChanged = oldStatus != s.getStatus();

        if (nowCancelled && !wasCancelled) {
            notificationService.notifyClassScheduleEvent(
                    NotificationType.CLASS_SESSION_CANCELLED, s.getClassId(), className(s.getClassId()), teacherId,
                    "Buổi học lớp " + className(s.getClassId()) + " " + WHEN_FMT.format(s.getStartAt())
                            + " đã bị huỷ (nghỉ học).");
        } else if (!nowCancelled && (timeChanged || placeChanged || statusChanged)) {
            notificationService.notifyClassScheduleEvent(
                    NotificationType.CLASS_SESSION_RESCHEDULED, s.getClassId(), className(s.getClassId()), teacherId,
                    "Buổi học lớp " + className(s.getClassId()) + " đã đổi: " + whenWhere(s) + ".");
        }
    }

    private String className(Long classId) {
        return classRepo.findById(classId).map(TeacherClass::getName).orElse("Lớp #" + classId);
    }

    private static String dowLabel(short dow) {
        return dow >= 1 && dow <= 7 ? DOW_VN[dow] : "Thứ ?";
    }

    /** "dd/MM/yyyy lúc HH:mm, phòng P.302" · "…, học Online" · "…, tại lớp". */
    private static String whenWhere(ClassSession s) {
        String place = s.getMode() == ClassSession.Mode.ONLINE ? "học Online"
                : (s.getRoom() != null && !s.getRoom().isBlank() ? "phòng " + s.getRoom() : "tại lớp");
        return WHEN_FMT.format(s.getStartAt()) + ", " + place;
    }

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
