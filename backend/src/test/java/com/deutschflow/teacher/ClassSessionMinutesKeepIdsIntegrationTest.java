package com.deutschflow.teacher;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.teacher.dto.ClassSessionDto;
import com.deutschflow.teacher.dto.CreateSessionRequest;
import com.deutschflow.teacher.dto.SessionSaveResult;
import com.deutschflow.teacher.dto.UpdateSessionRequest;
import com.deutschflow.teacher.dto.UpsertPatternRequest;
import com.deutschflow.teacher.dto.UpsertPatternResult;
import com.deutschflow.teacher.entity.ClassSession;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.ClassTeacherId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.entity.TeacherSessionRecord;
import com.deutschflow.teacher.repository.ClassSessionRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.teacher.repository.TeacherSessionRecordRepository;
import com.deutschflow.teacher.service.ClassScheduleService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * PR-3 (GĐ2): (1) regenerate kiểu UPSERT-GIỮ-ID — {@code class_sessions.id} sống qua đổi
 * pattern/job hằng ngày, liên kết theo buổi (bản ghi công) không bốc hơi (AC16/G1); (2) tách phút
 * học/nghỉ khỏi phút chiếm lịch theo D04 — lớp trung tâm buổi 195′ mặc định 180+15, kiểm xung đột
 * vẫn theo 195 (AC02); (3) unique ô lịch V292 chặn buổi "ma" trùng ô.
 */
@SpringBootTest
@DisplayName("Session minutes + keep-IDs Integration Tests (V292, AC02/AC16)")
class ClassSessionMinutesKeepIdsIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private ClassScheduleService service;
    @Autowired private ClassSessionRepository sessionRepo;
    @Autowired private TeacherClassRepository classRepo;
    @Autowired private ClassTeacherRepository classTeacherRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private TeacherSessionRecordRepository sessionRecordRepo;

    // ── (1) Giữ ID qua regenerate ───────────────────────────────────────────

    @Test
    @DisplayName("AC16/G1: đổi giờ pattern → buổi thường được CẬP NHẬT GIỮ ID (không xoá-tạo-lại)")
    void upsertPattern_keepsSessionIds_onTimeChange() {
        User t = newTeacher();
        TeacherClass c = newClass(t.getId(), null);
        link(c.getId(), t.getId());

        LocalDate from = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.MONDAY));
        LocalDate to = from.plusWeeks(2); // 3 buổi Thứ 2
        UpsertPatternResult r1 = service.upsertPattern(t.getId(), c.getId(),
                new UpsertPatternRequest((short) 1, LocalTime.of(18, 0), 90, "OFFLINE", "P.301", from, to));
        assertThat(r1.generated()).isEqualTo(3);

        Set<Long> idsBefore = sessionIds(c.getId());
        assertThat(idsBefore).hasSize(3);

        // Đổi giờ + phòng của CÙNG pattern → 0 buổi mới, 3 buổi cũ giữ id, giờ mới
        UpsertPatternResult r2 = service.upsertPattern(t.getId(), c.getId(),
                new UpsertPatternRequest((short) 1, LocalTime.of(19, 30), 90, "OFFLINE", "P.999", from, to));
        assertThat(r2.generated()).isZero();

        List<ClassSession> after = sessionRepo.findByClassIdAndStartAtBetweenOrderByStartAt(
                c.getId(), from.atStartOfDay(), to.plusDays(1).atStartOfDay());
        assertThat(after).hasSize(3);
        assertThat(after.stream().map(ClassSession::getId).collect(Collectors.toSet()))
                .isEqualTo(idsBefore);
        assertThat(after).allSatisfy(s -> {
            assertThat(s.getStartAt().toLocalTime()).isEqualTo(LocalTime.of(19, 30));
            assertThat(s.getRoom()).isEqualTo("P.999");
            assertThat(s.isOverridden()).isFalse();
        });
    }

    @Test
    @DisplayName("AC16: bản ghi công trỏ session vẫn nguyên vẹn sau khi tính lại lịch")
    void regenerate_preservesTimesheetLink() {
        User t = newTeacher();
        TeacherClass c = newClass(t.getId(), null);
        link(c.getId(), t.getId());

        LocalDate from = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.TUESDAY));
        service.upsertPattern(t.getId(), c.getId(),
                new UpsertPatternRequest((short) 2, LocalTime.of(9, 0), 90, "OFFLINE", "P.1", from, from.plusWeeks(1)));
        ClassSession target = sessionRepo.findByClassIdAndStartAtBetweenOrderByStartAt(
                c.getId(), from.atStartOfDay(), from.plusWeeks(2).atStartOfDay()).get(0);

        TeacherSessionRecord record = sessionRecordRepo.save(TeacherSessionRecord.builder()
                .teacherId(t.getId())
                .classId(c.getId())
                .sessionId(target.getId())
                .classNameSnapshot(c.getName())
                .startedAt(target.getStartAt())
                .durationMinutes(target.getDurationMinutes())
                .build());

        // Đổi pattern (trước PR-3 chỗ này xoá-tạo-lại buổi → link chết)
        service.upsertPattern(t.getId(), c.getId(),
                new UpsertPatternRequest((short) 2, LocalTime.of(10, 0), 100, "OFFLINE", "P.2", from, from.plusWeeks(1)));

        ClassSession survived = sessionRepo.findById(target.getId()).orElseThrow();
        assertThat(survived.getStartAt().toLocalTime()).isEqualTo(LocalTime.of(10, 0));
        Long linked = sessionRecordRepo.findById(record.getId()).orElseThrow().getSessionId();
        assertThat(linked).isEqualTo(target.getId());
    }

    @Test
    @DisplayName("job rollForwardActivePatterns chạy lại KHÔNG đổi id các buổi hiện có")
    void rollForward_keepsIds() {
        User t = newTeacher();
        TeacherClass c = newClass(t.getId(), null);
        link(c.getId(), t.getId());

        LocalDate from = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.WEDNESDAY));
        service.upsertPattern(t.getId(), c.getId(),
                new UpsertPatternRequest((short) 3, LocalTime.of(8, 0), 90, "OFFLINE", "P.5", from, null));
        Set<Long> before = sessionIds(c.getId());
        assertThat(before).isNotEmpty();

        service.rollForwardActivePatterns();
        service.rollForwardActivePatterns();

        Set<Long> after = sessionIds(c.getId());
        assertThat(after).containsAll(before); // id cũ còn nguyên; job chỉ có thể NỐI THÊM cửa sổ
    }

    @Test
    @DisplayName("rút ngắn effectiveTo: buổi thường ngoài dải bị gỡ, buổi trong dải giữ id, override giữ nguyên")
    void patternShrink_removesOnlyOutOfRange() {
        User t = newTeacher();
        TeacherClass c = newClass(t.getId(), null);
        link(c.getId(), t.getId());

        LocalDate from = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.THURSDAY));
        service.upsertPattern(t.getId(), c.getId(),
                new UpsertPatternRequest((short) 4, LocalTime.of(18, 0), 90, "OFFLINE", "P.7", from, from.plusWeeks(2)));
        List<ClassSession> generated = sessionRepo.findByClassIdAndStartAtBetweenOrderByStartAt(
                c.getId(), from.atStartOfDay(), from.plusWeeks(3).atStartOfDay());
        assertThat(generated).hasSize(3);
        Long keepId = generated.get(0).getId();
        ClassSession week3 = generated.get(2);
        week3.setOverridden(true);
        week3.setRoom("P.OVERRIDE");
        sessionRepo.saveAndFlush(week3);

        service.upsertPattern(t.getId(), c.getId(),
                new UpsertPatternRequest((short) 4, LocalTime.of(18, 0), 90, "OFFLINE", "P.7", from, from));

        List<ClassSession> after = sessionRepo.findByClassIdAndStartAtBetweenOrderByStartAt(
                c.getId(), from.atStartOfDay(), from.plusWeeks(3).atStartOfDay());
        assertThat(after).hasSize(2); // tuần 1 (giữ id) + tuần 3 (override) — tuần 2 bị gỡ
        assertThat(after).extracting(ClassSession::getId).contains(keepId, week3.getId());
    }

    // ── (2) Phút học/nghỉ D04 (AC02) ────────────────────────────────────────

    @Test
    @DisplayName("AC02: lớp trung tâm buổi 195′ → mặc định 180 học + 15 nghỉ; xung đột kiểm theo 195")
    void orgClass195_defaults_andConflictBoundary() {
        Organization org = newOrg();
        User t = newTeacher();
        TeacherClass c = newClass(t.getId(), org.getId());
        link(c.getId(), t.getId());

        LocalDateTime base = LocalDate.now().plusDays(9).atTime(8, 0);
        SessionSaveResult first = service.createSession(t.getId(), c.getId(),
                new CreateSessionRequest(base, 195, "OFFLINE", "P.101"));
        ClassSessionDto dto = first.session();
        assertThat(dto.teachingMinutes()).isEqualTo(180);
        assertThat(dto.breakMinutes()).isEqualTo(15);
        assertThat(dto.durationMinutes()).isEqualTo(195);

        // Buổi chiều chồng vào phút thứ 180 (vẫn trong 195′ chiếm lịch) → chặn cứng
        assertThatThrownBy(() -> service.createSession(t.getId(), c.getId(),
                new CreateSessionRequest(base.plusMinutes(180), 195, "OFFLINE", "P.101")))
                .isInstanceOf(BadRequestException.class);

        // Đúng ranh 195′ (11:15) → hợp lệ: hai buổi cùng ngày không chồng giờ (D07/AC05)
        SessionSaveResult second = service.createSession(t.getId(), c.getId(),
                new CreateSessionRequest(base.plusMinutes(195), 195, "OFFLINE", "P.101"));
        assertThat(second.session().teachingMinutes()).isEqualTo(180);
    }

    @Test
    @DisplayName("không đoán quá khứ: lớp cá nhân 195′ và lớp org khác 195′ giữ legacy teaching=duration")
    void legacyResolution_noGuessing() {
        User t = newTeacher();
        TeacherClass personal = newClass(t.getId(), null);
        link(personal.getId(), t.getId());
        LocalDateTime base = LocalDate.now().plusDays(11).atTime(8, 0);

        ClassSessionDto dto = service.createSession(t.getId(), personal.getId(),
                new CreateSessionRequest(base, 195, "OFFLINE", "P.1")).session();
        assertThat(dto.teachingMinutes()).isEqualTo(195); // lớp cá nhân: không áp D04
        assertThat(dto.breakMinutes()).isZero();

        Organization org = newOrg();
        TeacherClass orgClass = newClass(t.getId(), org.getId());
        link(orgClass.getId(), t.getId());
        ClassSessionDto dto90 = service.createSession(t.getId(), orgClass.getId(),
                new CreateSessionRequest(base.plusDays(1), 90, "OFFLINE", "P.2")).session();
        assertThat(dto90.teachingMinutes()).isEqualTo(90); // duration ≠ 195: không đoán
        assertThat(dto90.breakMinutes()).isZero();
    }

    @Test
    @DisplayName("khai tường minh: teaching + break phải bằng duration; sai → 400")
    void explicitMinutes_validated() {
        User t = newTeacher();
        TeacherClass c = newClass(t.getId(), null);
        link(c.getId(), t.getId());
        LocalDateTime base = LocalDate.now().plusDays(13).atTime(8, 0);

        assertThatThrownBy(() -> service.createSession(t.getId(), c.getId(),
                new CreateSessionRequest(base, 195, "OFFLINE", "P.1", 100, 10)))
                .isInstanceOf(BadRequestException.class);

        ClassSessionDto ok = service.createSession(t.getId(), c.getId(),
                new CreateSessionRequest(base, 195, "OFFLINE", "P.1", 180, 15)).session();
        assertThat(ok.teachingMinutes()).isEqualTo(180);
        assertThat(ok.breakMinutes()).isEqualTo(15);
    }

    @Test
    @DisplayName("buổi ĐÃ tách phút: đổi duration không kèm teaching/break → 400; kèm đủ → OK")
    void updateSession_splitSession_requiresMinutesOnDurationChange() {
        Organization org = newOrg();
        User t = newTeacher();
        TeacherClass c = newClass(t.getId(), org.getId());
        link(c.getId(), t.getId());
        LocalDateTime base = LocalDate.now().plusDays(15).atTime(8, 0);
        Long sessionId = service.createSession(t.getId(), c.getId(),
                new CreateSessionRequest(base, 195, "OFFLINE", "P.1")).session().id();

        assertThatThrownBy(() -> service.updateSession(t.getId(), sessionId,
                new UpdateSessionRequest(null, 180, null, "P.1", null)))
                .isInstanceOf(BadRequestException.class);

        ClassSessionDto updated = service.updateSession(t.getId(), sessionId,
                new UpdateSessionRequest(null, 180, null, "P.1", null, 165, 15)).session();
        assertThat(updated.durationMinutes()).isEqualTo(180);
        assertThat(updated.teachingMinutes()).isEqualTo(165);
        assertThat(updated.breakMinutes()).isEqualTo(15);
    }

    // ── (3) Unique ô lịch (V292) ────────────────────────────────────────────

    @Test
    @DisplayName("V292: hai buổi thường trùng (pattern_id, original_date) bị DB chặn — hết đường sinh buổi ma")
    void slotUniqueIndex_blocksPlainDuplicates() {
        User t = newTeacher();
        TeacherClass c = newClass(t.getId(), null);
        link(c.getId(), t.getId());
        LocalDate from = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.FRIDAY));
        service.upsertPattern(t.getId(), c.getId(),
                new UpsertPatternRequest((short) 5, LocalTime.of(18, 0), 90, "OFFLINE", "P.9", from, from));
        ClassSession seed = sessionRepo.findByClassIdAndStartAtBetweenOrderByStartAt(
                c.getId(), from.atStartOfDay(), from.plusDays(1).atStartOfDay()).get(0);

        LocalDate freeSlot = from.plusWeeks(30); // ô chưa từng sinh — tránh đụng dữ liệu upsert
        sessionRepo.saveAndFlush(plainAt(seed, freeSlot));
        assertThatThrownBy(() -> sessionRepo.saveAndFlush(plainAt(seed, freeSlot)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private static ClassSession plainAt(ClassSession template, LocalDate slot) {
        return ClassSession.builder()
                .classId(template.getClassId())
                .patternId(template.getPatternId())
                .startAt(slot.atTime(18, 0))
                .originalDate(slot)
                .durationMinutes(90)
                .mode(ClassSession.Mode.OFFLINE)
                .room("P.9")
                .status(ClassSession.Status.SCHEDULED)
                .overridden(false)
                .build();
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    private User newTeacher() {
        return userRepository.save(User.builder()
                .email("m195-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("Minutes Tester")
                .role(User.Role.TEACHER)
                .build());
    }

    private Organization newOrg() {
        return organizationRepo.save(Organization.builder()
                .name("TT " + UUID.randomUUID().toString().substring(0, 8))
                .slug("org-" + UUID.randomUUID())
                .seatLimit(50)
                .status("ACTIVE")
                .build());
    }

    private TeacherClass newClass(Long teacherId, Long orgId) {
        return classRepo.save(TeacherClass.builder()
                .teacherId(teacherId)
                .orgId(orgId)
                .name("A1 · " + UUID.randomUUID().toString().substring(0, 8))
                .inviteCode("INV-" + UUID.randomUUID())
                .createdAt(LocalDateTime.now())
                .build());
    }

    private void link(Long classId, Long teacherId) {
        classTeacherRepo.save(ClassTeacher.builder()
                .id(new ClassTeacherId(classId, teacherId))
                .role("PRIMARY")
                .joinedAt(LocalDateTime.now())
                .build());
    }

    private Set<Long> sessionIds(Long classId) {
        return sessionRepo.findByClassIdAndStartAtBetweenOrderByStartAt(
                        classId, LocalDate.now().atStartOfDay(), LocalDate.now().plusWeeks(20).atStartOfDay())
                .stream().map(ClassSession::getId).collect(Collectors.toSet());
    }
}
