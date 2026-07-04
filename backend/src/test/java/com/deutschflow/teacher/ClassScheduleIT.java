package com.deutschflow.teacher;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.teacher.dto.ClassSessionDto;
import com.deutschflow.teacher.dto.CreateSessionRequest;
import com.deutschflow.teacher.dto.SessionSaveResult;
import com.deutschflow.teacher.dto.UpsertPatternRequest;
import com.deutschflow.teacher.dto.UpsertPatternResult;
import com.deutschflow.teacher.entity.ClassSession;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.ClassTeacherId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassSessionRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.teacher.service.ClassScheduleService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Integration coverage for the V236 class-schedule schema against a real PostgreSQL (Testcontainers).
 * Proves what mocked unit tests cannot: the migration applies, entity↔column mapping (enums,
 * is_overridden, TIMESTAMP) round-trips, the NATIVE room-conflict interval query runs on Postgres,
 * and upsertPattern regenerate keeps overridden sessions through real persistence.
 */
@SpringBootTest
@DisplayName("Class schedule Integration Tests (V236 schema)")
class ClassScheduleIT extends AbstractPostgresIntegrationTest {

    @Autowired private ClassScheduleService service;
    @Autowired private ClassSessionRepository sessionRepo;
    @Autowired private TeacherClassRepository classRepo;
    @Autowired private ClassTeacherRepository classTeacherRepo;
    @Autowired private UserRepository userRepository;

    @Test
    @DisplayName("native findRoomConflicts detects overlap, excludes gaps, respects selfId / null-selfId")
    void roomConflicts_intervalMath() {
        User t = newTeacher();
        TeacherClass c = newClass(t.getId());
        LocalDateTime base = LocalDate.now().plusDays(10).atTime(18, 0); // 18:00–19:30 (90′)

        ClassSession a = saveSession(c.getId(), base, 90, "P.302");
        ClassSession b = saveSession(c.getId(), base.plusMinutes(60), 60, "P.302"); // 19:00–20:00 → overlaps a
        ClassSession far = saveSession(c.getId(), base.withHour(7), 60, "P.302");    // 07:00–08:00 → no overlap

        List<ClassSession> conflicts = sessionRepo.findRoomConflicts(
                "P.302", a.getStartAt(), a.getStartAt().plusMinutes(90), a.getId());
        assertThat(conflicts).extracting(ClassSession::getId)
                .contains(b.getId())
                .doesNotContain(a.getId(), far.getId());

        // null selfId (not-yet-persisted session) must NOT exclude anything → includes a itself
        List<ClassSession> all = sessionRepo.findRoomConflicts(
                "P.302", a.getStartAt(), a.getStartAt().plusMinutes(90), null);
        assertThat(all).extracting(ClassSession::getId).contains(a.getId(), b.getId());
    }

    @Test
    @DisplayName("weekForTeacher returns sessions of taught classes with className + studentCount")
    void weekForTeacher_mapsClass() {
        User t = newTeacher();
        TeacherClass c = newClass(t.getId());
        link(c.getId(), t.getId());

        LocalDate monday = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        saveSession(c.getId(), monday.plusDays(1).atTime(18, 0), 90, "P.302");

        List<ClassSessionDto> week = service.weekForTeacher(
                t.getId(), monday.atStartOfDay(), monday.plusDays(7).atStartOfDay());

        assertThat(week).hasSize(1);
        assertThat(week.get(0).className()).isEqualTo(c.getName());
        assertThat(week.get(0).studentCount()).isZero();
        assertThat(week.get(0).room()).isEqualTo("P.302");
        assertThat(week.get(0).status()).isEqualTo("SCHEDULED");
    }

    @Test
    @DisplayName("upsertPattern generates weekly sessions, then keeps the manually-edited one on re-run")
    void upsertPattern_regenerate_keepsOverride() {
        User t = newTeacher();
        TeacherClass c = newClass(t.getId());
        link(c.getId(), t.getId());

        LocalDate from = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.MONDAY));
        LocalDate to = from.plusWeeks(2); // Mondays: from, +1w, +2w → 3
        UpsertPatternRequest req = new UpsertPatternRequest(
                (short) 1, LocalTime.of(18, 0), 90, "OFFLINE", "P.302", from, to); // 1 = Monday (ISO)

        UpsertPatternResult r1 = service.upsertPattern(t.getId(), c.getId(), req);
        assertThat(r1.generated()).isEqualTo(3);
        assertThat(r1.keptOverridden()).isZero();

        List<ClassSession> gen = sessionRepo.findByClassIdAndStartAtBetweenOrderByStartAt(
                c.getId(), from.atStartOfDay(), to.plusDays(1).atStartOfDay());
        assertThat(gen).hasSize(3);

        // simulate a manual edit on the middle occurrence
        ClassSession edited = gen.get(1);
        edited.setOverridden(true);
        edited.setRoom("P.999");
        sessionRepo.saveAndFlush(edited);

        UpsertPatternResult r2 = service.upsertPattern(t.getId(), c.getId(), req);
        assertThat(r2.keptOverridden()).isEqualTo(1);
        assertThat(r2.generated()).isEqualTo(2);

        List<ClassSession> after = sessionRepo.findByClassIdAndStartAtBetweenOrderByStartAt(
                c.getId(), from.atStartOfDay(), to.plusDays(1).atStartOfDay());
        assertThat(after).hasSize(3);
        assertThat(after).anyMatch(s -> "P.999".equals(s.getRoom()) && s.isOverridden());
    }

    @Test
    @DisplayName("upsertPattern throws Forbidden when teacher does not teach the class (IDOR guard)")
    void upsertPattern_notOwner_forbidden() {
        User t = newTeacher();
        TeacherClass c = newClass(t.getId()); // intentionally NO class_teachers link

        assertThatThrownBy(() -> service.upsertPattern(t.getId(), c.getId(),
                new UpsertPatternRequest((short) 1, LocalTime.of(18, 0), 90, "OFFLINE", "P.302",
                        LocalDate.now(), null)))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("teacher double-booking: an overlapping session in another taught class is HARD-blocked")
    void teacherConflict_blocksOverlap_acrossClasses() {
        User t = newTeacher();
        TeacherClass a = newClass(t.getId());
        TeacherClass b = newClass(t.getId());
        link(a.getId(), t.getId());
        link(b.getId(), t.getId());

        LocalDateTime base = LocalDate.now().plusDays(5).atTime(18, 0); // 18:00–19:30 in class B
        saveSession(b.getId(), base, 90, "P.1");

        // Same teacher, DIFFERENT class, overlapping time → blocked (this is the reported bug).
        assertThatThrownBy(() -> service.createSession(t.getId(), a.getId(),
                new CreateSessionRequest(base.plusMinutes(30), 90, "OFFLINE", "P.2")))
                .isInstanceOf(BadRequestException.class);

        // A clearly non-overlapping slot for the same teacher still succeeds.
        SessionSaveResult ok = service.createSession(t.getId(), a.getId(),
                new CreateSessionRequest(base.plusHours(3), 60, "OFFLINE", "P.2"));
        assertThat(ok.session().id()).isNotNull();
    }

    // ── fixtures ────────────────────────────────────────────────────────────────

    private User newTeacher() {
        return userRepository.save(User.builder()
                .email("cs-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("Schedule Tester")
                .role(User.Role.TEACHER)
                .build());
    }

    private TeacherClass newClass(Long teacherId) {
        return classRepo.save(TeacherClass.builder()
                .teacherId(teacherId)
                .name("K30 · B1 Pflege")
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

    private ClassSession saveSession(Long classId, LocalDateTime startAt, int durationMinutes, String room) {
        return sessionRepo.save(ClassSession.builder()
                .classId(classId)
                .startAt(startAt)
                .durationMinutes(durationMinutes)
                .mode(ClassSession.Mode.OFFLINE)
                .room(room)
                .status(ClassSession.Status.SCHEDULED)
                .overridden(false)
                .build());
    }
}
