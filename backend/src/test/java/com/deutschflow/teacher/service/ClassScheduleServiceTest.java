package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.teacher.dto.*;
import com.deutschflow.teacher.entity.ClassSchedulePattern;
import com.deutschflow.teacher.entity.ClassSession;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.ClassTeacherId;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassSchedulePatternRepository;
import com.deutschflow.teacher.repository.ClassSessionRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("ClassScheduleService")
class ClassScheduleServiceTest {

    @Mock private ClassSchedulePatternRepository patternRepo;
    @Mock private ClassSessionRepository sessionRepo;
    @Mock private TeacherClassRepository classRepo;
    @Mock private ClassStudentRepository classStudentRepo;
    @Mock private ClassTeacherRepository classTeacherRepo;

    private ClassScheduleService service;

    private static final Long TEACHER_ID = 1L;
    private static final Long CLASS_ID = 10L;

    @BeforeEach
    void setUp() {
        service = new ClassScheduleService(patternRepo, sessionRepo, classRepo, classStudentRepo, classTeacherRepo);
    }

    // ── weekForTeacher ───────────────────────────────────────────────────────

    @Test
    @DisplayName("weekForTeacher returns empty (no DB scan) when teacher has no classes")
    void weekForTeacher_noClasses_empty() {
        when(classTeacherRepo.findByIdTeacherId(TEACHER_ID)).thenReturn(List.of());

        List<ClassSessionDto> result = service.weekForTeacher(
                TEACHER_ID, LocalDateTime.now(), LocalDateTime.now().plusDays(7));

        assertThat(result).isEmpty();
        verify(sessionRepo, never()).findForClassesInRange(anyList(), any(), any());
    }

    @Test
    @DisplayName("weekForTeacher maps className + studentCount per class (no N+1 surprises)")
    void weekForTeacher_mapsNamesAndCounts() {
        when(classTeacherRepo.findByIdTeacherId(TEACHER_ID)).thenReturn(List.of(
                classTeacher(10L), classTeacher(11L)));
        ClassSession a = session(100L, 10L, LocalDateTime.now().plusDays(1).withHour(18), "P.302", false);
        ClassSession b = session(101L, 11L, LocalDateTime.now().plusDays(2).withHour(9), null, false);
        b.setMode(ClassSession.Mode.ONLINE);
        when(sessionRepo.findForClassesInRange(anyList(), any(), any())).thenReturn(List.of(a, b));
        when(classRepo.findAllById(anyList())).thenReturn(List.of(
                teacherClass(10L, "K30 · B1 Pflege"), teacherClass(11L, "A2 tối")));
        when(classStudentRepo.countByIdClassId(10L)).thenReturn(13L);
        when(classStudentRepo.countByIdClassId(11L)).thenReturn(8L);

        List<ClassSessionDto> result = service.weekForTeacher(
                TEACHER_ID, LocalDateTime.now(), LocalDateTime.now().plusDays(7));

        assertThat(result).hasSize(2);
        ClassSessionDto k30 = result.stream().filter(d -> d.classId().equals(10L)).findFirst().orElseThrow();
        assertThat(k30.className()).isEqualTo("K30 · B1 Pflege");
        assertThat(k30.studentCount()).isEqualTo(13);
        assertThat(k30.room()).isEqualTo("P.302");
    }

    // ── weekForOrg (G-3: center-wide, org-scoped) ──────────────────────────────

    @Test
    @DisplayName("weekForOrg returns empty (no DB scan) when org has no classes")
    void weekForOrg_noClasses_empty() {
        when(classRepo.findByOrgId(7L)).thenReturn(List.of());

        List<ClassSessionDto> result = service.weekForOrg(
                7L, LocalDateTime.now(), LocalDateTime.now().plusDays(7));

        assertThat(result).isEmpty();
        verify(sessionRepo, never()).findForClassesInRange(anyList(), any(), any());
    }

    @Test
    @DisplayName("weekForOrg aggregates sessions across ALL org classes with name + count")
    void weekForOrg_aggregatesOrgClasses() {
        when(classRepo.findByOrgId(7L)).thenReturn(List.of(
                teacherClass(10L, "K30 · B1 Pflege"), teacherClass(11L, "A2 tối")));
        ClassSession a = session(100L, 10L, LocalDateTime.now().plusDays(1).withHour(18), "P.302", false);
        ClassSession b = session(101L, 11L, LocalDateTime.now().plusDays(2).withHour(9), null, false);
        when(sessionRepo.findForClassesInRange(anyList(), any(), any())).thenReturn(List.of(a, b));
        when(classRepo.findAllById(anyList())).thenReturn(List.of(
                teacherClass(10L, "K30 · B1 Pflege"), teacherClass(11L, "A2 tối")));
        when(classStudentRepo.countByIdClassId(10L)).thenReturn(13L);
        when(classStudentRepo.countByIdClassId(11L)).thenReturn(8L);

        List<ClassSessionDto> result = service.weekForOrg(
                7L, LocalDateTime.now(), LocalDateTime.now().plusDays(7));

        assertThat(result).extracting(ClassSessionDto::classId).containsExactlyInAnyOrder(10L, 11L);
        ClassSessionDto k30 = result.stream().filter(d -> d.classId().equals(10L)).findFirst().orElseThrow();
        assertThat(k30.className()).isEqualTo("K30 · B1 Pflege");
        assertThat(k30.studentCount()).isEqualTo(13);
    }

    @Test
    @DisplayName("weekForOrg rejects an invalid range before any query")
    void weekForOrg_invalidRange_throws() {
        assertThatThrownBy(() -> service.weekForOrg(
                7L, LocalDateTime.now(), LocalDateTime.now().minusDays(1)))
                .isInstanceOf(com.deutschflow.common.exception.BadRequestException.class);
        verify(classRepo, never()).findByOrgId(any(Long.class));
    }

    // ── upsertPattern: regenerate + override sticky (PO #1) ────────────────────

    @Test
    @DisplayName("upsertPattern regenerates future sessions but KEEPS overridden ones (sticky)")
    void upsertPattern_keepsOverridden() {
        LocalDate nextMon = LocalDate.now().with(TemporalAdjusters.next(DayOfWeek.MONDAY));
        LocalDate effFrom = nextMon;
        LocalDate effTo = nextMon.plusWeeks(3);                 // Mondays: nextMon, +1w, +2w, +3w
        LocalDate keptDate = nextMon.plusWeeks(1);

        UpsertPatternRequest req = new UpsertPatternRequest(
                (short) 0, LocalTime.of(18, 0), 90, "OFFLINE", "P.302", effFrom, effTo);

        allowOwner();
        when(patternRepo.findByClassIdAndDayOfWeek(CLASS_ID, (short) 0)).thenReturn(List.of());
        when(patternRepo.save(any())).thenAnswer(inv -> {
            ClassSchedulePattern p = inv.getArgument(0);
            p.setId(99L);
            return p;
        });
        ClassSession overridden = session(500L, CLASS_ID, keptDate.atTime(20, 0), "P.999", true);
        overridden.setPatternId(99L);
        ClassSession stale = session(501L, CLASS_ID, nextMon.atTime(18, 0), "P.302", false);
        stale.setPatternId(99L);
        when(sessionRepo.findByPatternIdAndStartAtGreaterThanEqual(eq(99L), any()))
                .thenReturn(List.of(overridden, stale));

        UpsertPatternResult res = service.upsertPattern(TEACHER_ID, CLASS_ID, req);

        // only the non-overridden future session is deleted
        ArgumentCaptor<List<ClassSession>> delCap = listCaptor();
        verify(sessionRepo).deleteAll(delCap.capture());
        assertThat(delCap.getValue()).extracting(ClassSession::getId).containsExactly(501L);

        // generated = Mondays in window EXCEPT the kept override date
        ArgumentCaptor<List<ClassSession>> saveCap = listCaptor();
        verify(sessionRepo).saveAll(saveCap.capture());
        List<ClassSession> generated = saveCap.getValue();
        assertThat(generated).hasSize(3);
        assertThat(generated).noneMatch(s -> s.getStartAt().toLocalDate().equals(keptDate));
        assertThat(generated).allSatisfy(s -> {
            assertThat(s.getPatternId()).isEqualTo(99L);
            assertThat(s.isOverridden()).isFalse();
            assertThat(s.getRoom()).isEqualTo("P.302");
            assertThat(s.getStartAt().toLocalTime()).isEqualTo(LocalTime.of(18, 0));
        });

        assertThat(res.patternId()).isEqualTo(99L);
        assertThat(res.generated()).isEqualTo(3);
        assertThat(res.keptOverridden()).isEqualTo(1);
    }

    // ── updateSession: override + soft room warning (PO #2) ────────────────────

    @Test
    @DisplayName("updateSession applies room change, marks overridden, returns soft room warning")
    void updateSession_roomWarning() {
        ClassSession s = session(5L, CLASS_ID, LocalDateTime.now().plusDays(1).withHour(18).withMinute(0),
                "P.302", false);
        when(sessionRepo.findById(5L)).thenReturn(Optional.of(s));
        allowOwner();
        when(sessionRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        ClassSession conflict = session(7L, 11L, LocalDateTime.now().plusDays(1).withHour(18).withMinute(30),
                "P.303", false);
        when(sessionRepo.findRoomConflicts(eq("P.303"), any(), any(), eq(5L))).thenReturn(List.of(conflict));
        when(classRepo.findById(CLASS_ID)).thenReturn(Optional.of(teacherClass(CLASS_ID, "K30")));
        when(classStudentRepo.countByIdClassId(CLASS_ID)).thenReturn(13L);

        SessionSaveResult result = service.updateSession(TEACHER_ID, 5L,
                new UpdateSessionRequest(null, null, null, "P.303", null));

        assertThat(s.isOverridden()).isTrue();
        assertThat(s.getRoom()).isEqualTo("P.303");
        assertThat(result.roomWarnings()).hasSize(1);
        assertThat(result.roomWarnings().get(0)).contains("P.303").contains("#7");
        assertThat(result.session().className()).isEqualTo("K30");
        assertThat(result.session().studentCount()).isEqualTo(13);
    }

    @Test
    @DisplayName("updateSession switching to ONLINE clears room and emits no room warning")
    void updateSession_onlineClearsRoom() {
        ClassSession s = session(5L, CLASS_ID, LocalDateTime.now().plusDays(1).withHour(18), "P.302", false);
        when(sessionRepo.findById(5L)).thenReturn(Optional.of(s));
        allowOwner();
        when(sessionRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(classRepo.findById(CLASS_ID)).thenReturn(Optional.of(teacherClass(CLASS_ID, "K30")));
        when(classStudentRepo.countByIdClassId(CLASS_ID)).thenReturn(13L);

        SessionSaveResult result = service.updateSession(TEACHER_ID, 5L,
                new UpdateSessionRequest(null, null, "ONLINE", "P.302", null));

        assertThat(s.getMode()).isEqualTo(ClassSession.Mode.ONLINE);
        assertThat(s.getRoom()).isNull();
        assertThat(result.roomWarnings()).isEmpty();
        verify(sessionRepo, never()).findRoomConflicts(any(), any(), any(), any());
    }

    @Test
    @DisplayName("updateSession throws Forbidden when teacher does not teach the class (IDOR guard)")
    void updateSession_notOwner_forbidden() {
        ClassSession s = session(5L, CLASS_ID, LocalDateTime.now().plusDays(1), "P.302", false);
        when(sessionRepo.findById(5L)).thenReturn(Optional.of(s));
        when(classTeacherRepo.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(false);

        assertThatThrownBy(() -> service.updateSession(TEACHER_ID, 5L,
                new UpdateSessionRequest(null, null, null, "P.303", null)))
                .isInstanceOf(ForbiddenException.class);
        verify(sessionRepo, never()).save(any());
    }

    // ── createSession + deletePattern ──────────────────────────────────────────

    @Test
    @DisplayName("createSession stores an ad-hoc session as overridden with no pattern")
    void createSession_adHoc() {
        allowOwner();
        when(sessionRepo.save(any())).thenAnswer(inv -> {
            ClassSession x = inv.getArgument(0);
            x.setId(900L);
            return x;
        });
        when(sessionRepo.findRoomConflicts(any(), any(), any(), eq(900L))).thenReturn(List.of());
        when(classRepo.findById(CLASS_ID)).thenReturn(Optional.of(teacherClass(CLASS_ID, "K30")));
        when(classStudentRepo.countByIdClassId(CLASS_ID)).thenReturn(13L);

        SessionSaveResult result = service.createSession(TEACHER_ID, CLASS_ID,
                new CreateSessionRequest(LocalDateTime.now().plusDays(2).withHour(9).withMinute(0), 60, "OFFLINE", "P.101"));

        ArgumentCaptor<ClassSession> cap = ArgumentCaptor.forClass(ClassSession.class);
        verify(sessionRepo).save(cap.capture());
        assertThat(cap.getValue().getPatternId()).isNull();
        assertThat(cap.getValue().isOverridden()).isTrue();
        assertThat(result.roomWarnings()).isEmpty();
    }

    @Test
    @DisplayName("deletePattern removes future non-overridden sessions, keeps overridden, deletes the pattern")
    void deletePattern_keepsOverridden() {
        ClassSchedulePattern p = ClassSchedulePattern.builder()
                .id(99L).classId(CLASS_ID).dayOfWeek((short) 0).startTime(LocalTime.of(18, 0))
                .durationMinutes(90).defaultMode(ClassSchedulePattern.Mode.OFFLINE)
                .effectiveFrom(LocalDate.now()).build();
        when(patternRepo.findById(99L)).thenReturn(Optional.of(p));
        allowOwner();
        ClassSession ov = session(500L, CLASS_ID, LocalDateTime.now().plusDays(7), "P.1", true);
        ClassSession st = session(501L, CLASS_ID, LocalDateTime.now().plusDays(8), "P.1", false);
        when(sessionRepo.findByPatternIdAndStartAtGreaterThanEqual(eq(99L), any()))
                .thenReturn(List.of(ov, st));

        int removed = service.deletePattern(TEACHER_ID, 99L);

        ArgumentCaptor<List<ClassSession>> delCap = listCaptor();
        verify(sessionRepo).deleteAll(delCap.capture());
        assertThat(delCap.getValue()).extracting(ClassSession::getId).containsExactly(501L);
        verify(patternRepo).delete(p);
        assertThat(removed).isEqualTo(1);
    }

    // ── helpers ─────────────────────────────────────────────────────────────────

    private void allowOwner() {
        when(classTeacherRepo.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
    }

    private static ClassTeacher classTeacher(Long classId) {
        return ClassTeacher.builder().id(new ClassTeacherId(classId, TEACHER_ID)).role("PRIMARY").build();
    }

    private static TeacherClass teacherClass(Long id, String name) {
        return TeacherClass.builder().id(id).teacherId(TEACHER_ID).name(name).inviteCode("INV" + id).build();
    }

    private static ClassSession session(Long id, Long classId, LocalDateTime startAt, String room, boolean overridden) {
        return ClassSession.builder()
                .id(id).classId(classId).startAt(startAt).durationMinutes(90)
                .mode(ClassSession.Mode.OFFLINE).room(room)
                .status(ClassSession.Status.SCHEDULED).overridden(overridden)
                .build();
    }

    @SuppressWarnings("unchecked")
    private static ArgumentCaptor<List<ClassSession>> listCaptor() {
        return ArgumentCaptor.forClass(List.class);
    }
}
