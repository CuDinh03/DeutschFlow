package com.deutschflow.organization.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.PracticeProgramDtos.ProgramDto;
import com.deutschflow.organization.dto.PracticeProgramDtos.SaveRequest;
import com.deutschflow.organization.entity.ClassPracticeProgram;
import com.deutschflow.organization.repository.ClassPracticeProgramRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Chương trình luyện của lớp (đặc tả luyendeu): khai/sửa (ORG-50), khoá sau tuần 1 (ORG-51) và cờ "chỉ nói"
 * cho học viên (ORG-65). Mọi mốc ngày tính theo giờ Việt Nam.
 */
@Service
@RequiredArgsConstructor
public class ClassPracticeProgramService {

    public static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    public static final String EVENT_SAVED = "org.practice_program.saved";

    static final int DEFAULT_WEEKS = 6;
    static final int DEFAULT_TARGET = 3;
    static final int DEFAULT_REQUIRED = 4;

    private final ClassPracticeProgramRepository programRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final AuditLogService auditLogService;
    private final Clock clock;

    LocalDate today() {
        return LocalDate.now(clock.withZone(VN));
    }

    /** Chương trình của lớp thuộc {@code orgId}; lớp không thuộc org ⇒ 404 (chống IDOR). */
    @Transactional(readOnly = true)
    public Optional<ProgramDto> get(Long orgId, Long classId) {
        requireClassInOrg(orgId, classId);
        return programRepository.findById(classId).map(p -> toDto(p, today()));
    }

    @Transactional
    public ProgramDto save(Long orgId, Long classId, SaveRequest req, AuditActor actor) {
        requireClassInOrg(orgId, classId);
        if (req == null || req.startDate() == null) {
            throw new BadRequestException("Cần ngày bắt đầu chương trình");
        }
        LocalDate start = req.startDate();
        int weeks = req.weeks() == null ? DEFAULT_WEEKS : req.weeks();
        int target = req.targetPerWeek() == null ? DEFAULT_TARGET : req.targetPerWeek();
        int required = req.weeksRequired() == null ? Math.min(DEFAULT_REQUIRED, weeks) : req.weeksRequired();

        if (start.getDayOfWeek() != DayOfWeek.MONDAY) {
            throw new BadRequestException("Ngày bắt đầu phải là thứ Hai");
        }
        if (weeks < 1 || weeks > 12) {
            throw new BadRequestException("Số tuần phải từ 1 đến 12");
        }
        if (target < 1 || target > 14) {
            throw new BadRequestException("Chỉ tiêu phải từ 1 đến 14 phiên mỗi tuần");
        }
        if (required < 1 || required > weeks) {
            throw new BadRequestException("Số tuần đạt yêu cầu phải từ 1 đến số tuần của chương trình");
        }

        LocalDate today = today();
        Optional<ClassPracticeProgram> existing = programRepository.findById(classId);
        Map<String, Object> meta = new LinkedHashMap<>();
        ClassPracticeProgram p;
        if (existing.isPresent()) {
            p = existing.get();
            meta.put("old", snapshot(p));
            if (isLocked(p, today)) {
                if (!start.equals(p.getStartDate()) || target != p.getTargetPerWeek()
                        || required != p.getWeeksRequired()) {
                    throw new ConflictException(
                            "Tuần 1 đã qua: không đổi được ngày bắt đầu, chỉ tiêu hay số tuần đạt yêu cầu");
                }
                int current = currentWeek(p.getStartDate(), p.getWeeks(), today);
                if (weeks != p.getWeeks() && weeks < current) {
                    throw new ConflictException("Chỉ đổi được số tuần khi tuần mới chưa bắt đầu");
                }
            }
            p.setUpdatedBy(actor == null ? null : actor.id());
        } else {
            p = ClassPracticeProgram.builder().classId(classId).createdBy(actor == null ? null : actor.id())
                    .updatedBy(actor == null ? null : actor.id()).build();
        }
        p.setStartDate(start);
        p.setWeeks(weeks);
        p.setTargetPerWeek(target);
        p.setWeeksRequired(required);
        ClassPracticeProgram saved = programRepository.save(p);

        meta.put("new", snapshot(saved));
        auditLogService.log(EVENT_SAVED, actor, "CLASS", String.valueOf(classId), orgId, meta);
        return toDto(saved, today);
    }

    /** ORG-65: học viên đang ACTIVE ở lớp có chương trình chưa kết thúc ⇒ chỉ luyện bằng giọng nói. */
    @Transactional(readOnly = true)
    public boolean isSpeakOnly(Long studentId) {
        if (studentId == null) {
            return false;
        }
        return programRepository.isStudentInRunningProgram(studentId, today());
    }

    // ── nội bộ ───────────────────────────────────────────────────────────────

    private void requireClassInOrg(Long orgId, Long classId) {
        teacherClassRepository.findById(classId)
                .filter(c -> Objects.equals(orgId, c.getOrgId()))
                .orElseThrow(() -> new NotFoundException("Không tìm thấy lớp trong tổ chức"));
    }

    /** Khoá theo ORG-51 khi tuần 1 đã kết thúc (PR sau: khi tuần 1 đã CHỐT). */
    static boolean isLocked(ClassPracticeProgram p, LocalDate today) {
        return !today.isBefore(p.getStartDate().plusWeeks(1));
    }

    /** 0 = chưa bắt đầu; 1…weeks = đang chạy; weeks+1 = đã kết thúc. */
    static int currentWeek(LocalDate start, int weeks, LocalDate today) {
        if (today.isBefore(start)) {
            return 0;
        }
        long w = ChronoUnit.DAYS.between(start, today) / 7 + 1;
        return (int) Math.min(w, weeks + 1L);
    }

    private static Map<String, Object> snapshot(ClassPracticeProgram p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("startDate", p.getStartDate() == null ? null : p.getStartDate().toString());
        m.put("weeks", p.getWeeks());
        m.put("targetPerWeek", p.getTargetPerWeek());
        m.put("weeksRequired", p.getWeeksRequired());
        return m;
    }

    private static ProgramDto toDto(ClassPracticeProgram p, LocalDate today) {
        return new ProgramDto(p.getClassId(), p.getStartDate(), p.getWeeks(), p.getTargetPerWeek(),
                p.getWeeksRequired(), p.endExclusive().minusDays(1),
                currentWeek(p.getStartDate(), p.getWeeks(), today), isLocked(p, today));
    }
}
