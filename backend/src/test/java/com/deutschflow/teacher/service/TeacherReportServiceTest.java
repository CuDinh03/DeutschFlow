package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.dto.ClassSummaryDto;
import com.deutschflow.teacher.dto.ClassTrendDto;
import com.deutschflow.teacher.dto.GradebookDto;
import com.deutschflow.teacher.dto.SkillDistributionDto;
import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.StudentAssignment;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TeacherReportServiceTest {

    @Mock
    private TeacherClassRepository classRepository;

    @Mock
    private ClassTeacherRepository classTeacherRepository;

    @Mock
    private ClassStudentRepository classStudentRepository;

    @Mock
    private ClassAssignmentRepository assignmentRepository;

    @Mock
    private StudentAssignmentRepository studentAssignmentRepository;

    @Mock
    private UserRepository userRepository;

    private TeacherReportService service;

    @BeforeEach
    void setUp() {
        service = new TeacherReportService(
                classRepository,
                classTeacherRepository,
                classStudentRepository,
                assignmentRepository,
                studentAssignmentRepository,
                userRepository
        );
    }

    // ─── gradebook ───────────────────────────────────────────────────────────────

    @Test
    void gradebook_throwsForbidden_whenTeacherDoesNotOwnClass() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(100L, 1L)).thenReturn(false);

        assertThrows(ForbiddenException.class, () -> service.gradebook(1L, 100L));
        verify(assignmentRepository, never()).findByClassIdOrderByCreatedAtDesc(any());
    }

    @Test
    void gradebook_throwsNotFound_whenClassMissing() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(100L, 1L)).thenReturn(true);
        when(classRepository.findById(100L)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> service.gradebook(1L, 100L));
    }

    @Test
    void gradebook_buildsMatrix_withScoresStatusesAndAverages() {
        Long teacherId = 1L, classId = 100L;
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)).thenReturn(true);
        when(classRepository.findById(classId)).thenReturn(Optional.of(
                TeacherClass.builder().id(classId).name("Lớp A1").build()));

        // Repo returns newest-first; gradebook must reverse to oldest-first columns
        ClassAssignment newer = ClassAssignment.builder()
                .id(11L).classId(classId).topic("Bài 2").assignmentType("GENERAL")
                .dueDate(LocalDateTime.of(2026, 6, 20, 0, 0)).build();
        ClassAssignment older = ClassAssignment.builder()
                .id(10L).classId(classId).topic("Bài 1").assignmentType("GENERAL").build();
        when(assignmentRepository.findByClassIdOrderByCreatedAtDesc(classId))
                .thenReturn(List.of(newer, older));

        when(classStudentRepository.findByIdClassId(classId)).thenReturn(List.of(
                ClassStudent.builder().id(new ClassStudentId(classId, 200L)).build(),
                ClassStudent.builder().id(new ClassStudentId(classId, 201L)).build()));

        User anna = User.builder().id(200L).displayName("Anna").email("anna@x.de").build();
        User ben = User.builder().id(201L).displayName("Ben").email("ben@x.de").build();
        when(userRepository.findAllById(List.of(200L, 201L))).thenReturn(List.of(anna, ben));

        when(studentAssignmentRepository.findByAssignmentIds(List.of(10L, 11L))).thenReturn(List.of(
                StudentAssignment.builder().assignmentId(10L).studentId(200L).status("EVALUATED").score(8).build(),
                StudentAssignment.builder().assignmentId(11L).studentId(200L).status("EVALUATED").score(6).build(),
                StudentAssignment.builder().assignmentId(10L).studentId(201L).status("SUBMITTED").build()));

        GradebookDto result = service.gradebook(teacherId, classId);

        assertEquals("Lớp A1", result.className());
        // columns oldest-first
        assertEquals(List.of(10L, 11L), result.assignments().stream().map(GradebookDto.AssignmentColumn::id).toList());

        assertEquals(2, result.students().size());
        GradebookDto.StudentRow annaRow = result.students().get(0); // sorted by name: Anna, Ben
        assertEquals("Anna", annaRow.name());
        assertEquals(8, annaRow.cells().get(10L).score());
        assertEquals(6, annaRow.cells().get(11L).score());
        assertEquals(7.0, annaRow.avgScore());

        GradebookDto.StudentRow benRow = result.students().get(1);
        assertEquals("SUBMITTED", benRow.cells().get(10L).status());
        assertNull(benRow.cells().get(10L).score());
        assertNull(benRow.avgScore()); // no graded score yet
        assertNull(benRow.cells().get(11L)); // never assigned → empty cell
    }

    @Test
    void gradebook_clampsOutOfRangeScores_inAverage() {
        Long teacherId = 1L, classId = 100L;
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)).thenReturn(true);
        when(classRepository.findById(classId)).thenReturn(Optional.of(
                TeacherClass.builder().id(classId).name("Lớp A1").build()));
        ClassAssignment a2 = ClassAssignment.builder()
                .id(11L).classId(classId).topic("Bài 2").assignmentType("GENERAL").build();
        ClassAssignment a1 = ClassAssignment.builder()
                .id(10L).classId(classId).topic("Bài 1").assignmentType("GENERAL").build();
        when(assignmentRepository.findByClassIdOrderByCreatedAtDesc(classId)).thenReturn(List.of(a2, a1));
        when(classStudentRepository.findByIdClassId(classId)).thenReturn(List.of(
                ClassStudent.builder().id(new ClassStudentId(classId, 200L)).build()));
        when(userRepository.findAllById(List.of(200L))).thenReturn(List.of(
                User.builder().id(200L).displayName("Anna").email("anna@x.de").build()));
        // 90 + a bogus 234 (out-of-range manual entry) → 234 clamps to 100 → avg (90+100)/2 = 95.0, NOT 162.0
        when(studentAssignmentRepository.findByAssignmentIds(List.of(10L, 11L))).thenReturn(List.of(
                StudentAssignment.builder().assignmentId(10L).studentId(200L).status("EVALUATED").score(90).build(),
                StudentAssignment.builder().assignmentId(11L).studentId(200L).status("EVALUATED").score(234).build()));

        GradebookDto result = service.gradebook(teacherId, classId);

        assertEquals(95.0, result.students().get(0).avgScore());
    }

    @Test
    void gradebook_returnsEmptyMatrix_whenClassHasNoAssignments() {
        Long teacherId = 1L, classId = 100L;
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)).thenReturn(true);
        when(classRepository.findById(classId)).thenReturn(Optional.of(
                TeacherClass.builder().id(classId).name("Lớp trống").build()));
        when(assignmentRepository.findByClassIdOrderByCreatedAtDesc(classId)).thenReturn(List.of());
        when(classStudentRepository.findByIdClassId(classId)).thenReturn(List.of());

        GradebookDto result = service.gradebook(teacherId, classId);

        assertTrue(result.assignments().isEmpty());
        assertTrue(result.students().isEmpty());
        verify(studentAssignmentRepository, never()).findByAssignmentIds(any());
    }

    // ─── averageScore: confirmed-only + one-vote-per-student ──────────────────────

    @Test
    void classReport_averagesPerStudent_andExcludesUnconfirmedAiGrades() {
        Long teacherId = 1L, classId = 100L;
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)).thenReturn(true);
        when(classStudentRepository.countByIdClassId(classId)).thenReturn(2L);
        ClassAssignment a1 = ClassAssignment.builder().id(10L).classId(classId).topic("B1").assignmentType("GENERAL").build();
        ClassAssignment a2 = ClassAssignment.builder().id(11L).classId(classId).topic("B2").assignmentType("GENERAL").build();
        when(assignmentRepository.findByClassIdOrderByCreatedAtDesc(classId)).thenReturn(List.of(a2, a1));
        // Student 200: two confirmed grades 80 & 100 → per-student mean 90.
        // Student 201: one confirmed grade 60, plus an AI_GRADED 0 that MUST be ignored.
        // Class avg = mean of the per-student means (90, 60) = 75.0.
        //   A flat mean of all scored rows would be (80+100+60)/3 = 80.0;
        //   if the AI proposal leaked it would be (80+100+0+60)/4 = 60.0.
        // 75.0 proves both the isFinal filter AND the per-student weighting.
        when(studentAssignmentRepository.findByAssignmentIds(anyList())).thenReturn(List.of(
                StudentAssignment.builder().assignmentId(10L).studentId(200L).status("EVALUATED").score(80).build(),
                StudentAssignment.builder().assignmentId(11L).studentId(200L).status("GRADED").score(100).build(),
                StudentAssignment.builder().assignmentId(10L).studentId(201L).status("EVALUATED").score(60).build(),
                StudentAssignment.builder().assignmentId(11L).studentId(201L).status("AI_GRADED").score(0).build()));

        Map<String, Object> result = service.classReport(teacherId, classId);

        assertEquals(75.0, result.get("avgScore"));
        assertEquals(2L, result.get("studentCount"));
        assertEquals(2, result.get("assignmentCount"));
    }

    @Test
    void overview_countsDistinctStudents_andAveragesConfirmedGradesOnly() {
        Long teacherId = 1L;
        when(classRepository.findByTeacherId(teacherId)).thenReturn(List.of(
                TeacherClass.builder().id(100L).name("A1").build()));
        when(classStudentRepository.findByIdClassIdIn(anyList())).thenReturn(List.of(
                ClassStudent.builder().id(new ClassStudentId(100L, 1L)).build(),
                ClassStudent.builder().id(new ClassStudentId(100L, 2L)).build()));
        ClassAssignment a = ClassAssignment.builder().id(10L).classId(100L).topic("x").assignmentType("GENERAL").build();
        when(assignmentRepository.findByClassIdIn(anyList())).thenReturn(List.of(a));
        when(studentAssignmentRepository.findByAssignmentIds(anyList())).thenReturn(List.of(
                StudentAssignment.builder().assignmentId(10L).studentId(1L).status("EVALUATED").score(70).build(),
                StudentAssignment.builder().assignmentId(10L).studentId(2L).status("SUBMITTED").build())); // ungraded

        Map<String, Object> result = service.overview(teacherId);

        assertEquals(1, result.get("classCount"));
        assertEquals(2, result.get("studentCount"));
        assertEquals(1, result.get("assignmentCount"));
        assertEquals(70.0, result.get("avgScore")); // only student 1 has a confirmed grade
    }

    // ─── classesSummary: one batched pass, per-class rows ─────────────────────────

    @Test
    void classesSummary_buildsPerClassRows_withConfirmedOnlyAverages() {
        Long teacherId = 1L;
        when(classRepository.findByTeacherId(teacherId)).thenReturn(List.of(
                TeacherClass.builder().id(100L).name("A1").build(),
                TeacherClass.builder().id(200L).name("A2").build()));
        when(classStudentRepository.findByIdClassIdIn(anyList())).thenReturn(List.of(
                ClassStudent.builder().id(new ClassStudentId(100L, 1L)).build(),
                ClassStudent.builder().id(new ClassStudentId(100L, 2L)).build(),
                ClassStudent.builder().id(new ClassStudentId(200L, 3L)).build()));
        ClassAssignment a1 = ClassAssignment.builder().id(10L).classId(100L).topic("x").assignmentType("GENERAL").build();
        ClassAssignment a2 = ClassAssignment.builder().id(20L).classId(200L).topic("y").assignmentType("GENERAL").build();
        when(assignmentRepository.findByClassIdIn(anyList())).thenReturn(List.of(a1, a2));
        when(studentAssignmentRepository.findByAssignmentIds(anyList())).thenReturn(List.of(
                StudentAssignment.builder().assignmentId(10L).studentId(1L).status("EVALUATED").score(80).build(),
                StudentAssignment.builder().assignmentId(10L).studentId(2L).status("AI_GRADED").score(100).build(), // excluded
                StudentAssignment.builder().assignmentId(20L).studentId(3L).status("GRADED").score(60).build()));

        List<ClassSummaryDto> rows = service.classesSummary(teacherId);

        assertEquals(2, rows.size());
        ClassSummaryDto a1Row = rows.get(0);
        assertEquals(100L, a1Row.id());
        assertEquals("A1", a1Row.name());
        assertEquals(2L, a1Row.studentCount());
        assertEquals(1L, a1Row.assignmentCount());
        assertEquals(80.0, a1Row.avgScore()); // AI_GRADED proposal excluded → only the confirmed 80
        ClassSummaryDto a2Row = rows.get(1);
        assertEquals(200L, a2Row.id());
        assertEquals(1L, a2Row.studentCount());
        assertEquals(1L, a2Row.assignmentCount());
        assertEquals(60.0, a2Row.avgScore());
    }

    @Test
    void classesSummary_emptyWhenTeacherHasNoClasses() {
        when(classRepository.findByTeacherId(1L)).thenReturn(List.of());

        assertTrue(service.classesSummary(1L).isEmpty());
        verify(assignmentRepository, never()).findByClassIdIn(any());
    }

    // ─── weeklyTrends: bucket assembly + per-class series alignment ────────────────

    @Test
    void weeklyTrends_assemblesSortedBuckets_andAlignsSeriesWithGapsAsNull() {
        Long teacherId = 1L;
        when(classRepository.findByTeacherId(teacherId)).thenReturn(List.of(
                TeacherClass.builder().id(100L).name("A1").build(),
                TeacherClass.builder().id(200L).name("A2").build()));
        // A1 has data in two weeks; A2 only in the later week → its earlier value must be null.
        when(studentAssignmentRepository.findWeeklyConfirmedAverages(anyList())).thenReturn(List.of(
                new Object[]{100L, "2026-W23", 70.0, 2L},
                new Object[]{100L, "2026-W24", 80.0, 3L},
                new Object[]{200L, "2026-W24", 90.0, 1L}));

        ClassTrendDto trend = service.weeklyTrends(teacherId);

        assertEquals(List.of("2026-W23", "2026-W24"), trend.buckets());
        assertEquals(2, trend.series().size());
        ClassTrendDto.Series a1 = trend.series().get(0);
        assertEquals("A1", a1.className());
        assertEquals(List.of(70.0, 80.0), a1.values());
        ClassTrendDto.Series a2 = trend.series().get(1);
        assertEquals("A2", a2.className());
        assertEquals(Arrays.asList(null, 90.0), a2.values());
    }

    @Test
    void weeklyTrends_emptyWhenNoClasses() {
        when(classRepository.findByTeacherId(1L)).thenReturn(List.of());

        ClassTrendDto trend = service.weeklyTrends(1L);

        assertTrue(trend.buckets().isEmpty());
        assertTrue(trend.series().isEmpty());
        verify(studentAssignmentRepository, never()).findWeeklyConfirmedAverages(any());
    }

    // ─── skillDistribution: cross-class 4-skill averages ──────────────────────────

    @Test
    void skillDistribution_averagesEachSkillOverRatedStudents() {
        Long teacherId = 1L;
        when(classRepository.findByTeacherId(teacherId)).thenReturn(List.of(
                TeacherClass.builder().id(100L).name("A1").build()));
        when(classStudentRepository.findByIdClassIdIn(anyList())).thenReturn(List.of(
                ClassStudent.builder().id(new ClassStudentId(100L, 1L))
                        .skillHoren(BigDecimal.valueOf(8.0)).skillLesen(BigDecimal.valueOf(6.0))
                        .skillSprechen(BigDecimal.valueOf(7.0)).build(),
                ClassStudent.builder().id(new ClassStudentId(100L, 2L))
                        .skillHoren(BigDecimal.valueOf(6.0)).build(),
                ClassStudent.builder().id(new ClassStudentId(100L, 3L)).build())); // unrated

        SkillDistributionDto dist = service.skillDistribution(teacherId);

        assertEquals(7.0, dist.horen()); // (8 + 6) / 2
        assertEquals(6.0, dist.lesen()); // only student 1
        assertNull(dist.schreiben()); // nobody rated
        assertEquals(7.0, dist.sprechen());
        assertEquals(2L, dist.ratedCount()); // students 1 and 2; student 3 has no skills
    }

    @Test
    void skillDistribution_countsAMultiClassStudentOnce() {
        Long teacherId = 1L;
        when(classRepository.findByTeacherId(teacherId)).thenReturn(List.of(
                TeacherClass.builder().id(100L).name("A1").build(),
                TeacherClass.builder().id(200L).name("A2").build()));
        // Student 1 is enrolled in BOTH classes (Hören 8.0 in A1, 4.0 in A2); student 2 only in A1 (8.0).
        // Student 1 collapses to a single mean 6.0 → distribution Hören = (6.0 + 8.0) / 2 = 7.0.
        // Without dedup it would be (8 + 4 + 8) / 3 = 6.7 and ratedCount 3 — proving the fix.
        when(classStudentRepository.findByIdClassIdIn(anyList())).thenReturn(List.of(
                ClassStudent.builder().id(new ClassStudentId(100L, 1L)).skillHoren(BigDecimal.valueOf(8.0)).build(),
                ClassStudent.builder().id(new ClassStudentId(200L, 1L)).skillHoren(BigDecimal.valueOf(4.0)).build(),
                ClassStudent.builder().id(new ClassStudentId(100L, 2L)).skillHoren(BigDecimal.valueOf(8.0)).build()));

        SkillDistributionDto dist = service.skillDistribution(teacherId);

        assertEquals(7.0, dist.horen());
        assertEquals(2L, dist.ratedCount()); // 2 distinct students, not 3 enrollment rows
    }

    @Test
    void skillDistribution_emptyWhenNoClasses() {
        when(classRepository.findByTeacherId(1L)).thenReturn(List.of());

        SkillDistributionDto dist = service.skillDistribution(1L);

        assertNull(dist.horen());
        assertEquals(0L, dist.ratedCount());
    }
}
