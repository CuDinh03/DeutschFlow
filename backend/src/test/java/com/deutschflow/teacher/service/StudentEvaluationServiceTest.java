package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.dto.SkillReportDto;
import com.deutschflow.teacher.dto.StudentEvaluationDto;
import com.deutschflow.teacher.dto.StudentEvaluationRequest;
import com.deutschflow.teacher.entity.*;
import com.deutschflow.teacher.repository.*;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StudentEvaluationServiceTest {

    @Mock private ClassStudentRepository classStudentRepository;
    @Mock private ClassTeacherRepository classTeacherRepository;
    @Mock private ClassLessonLogRepository lessonLogRepository;
    @Mock private ClassAttendanceRepository attendanceRepository;
    @Mock private ClassAssignmentRepository assignmentRepository;
    @Mock private StudentAssignmentRepository studentAssignmentRepository;
    @Mock private TeacherClassRepository classRepository;
    @Mock private UserRepository userRepository;

    private StudentEvaluationService service;

    private static final Long TEACHER_ID = 1L;
    private static final Long CLASS_ID   = 10L;
    private static final Long STUDENT_ID = 200L;

    @BeforeEach
    void setUp() {
        service = new StudentEvaluationService(
                classStudentRepository, classTeacherRepository,
                lessonLogRepository, attendanceRepository,
                assignmentRepository, studentAssignmentRepository,
                classRepository, userRepository);
    }

    // ── saveEvaluation ────────────────────────────────────────────────────────

    @Test
    @DisplayName("saveEvaluation persists all four skill scores and comment")
    void saveEvaluation_validRequest_savesAllFields() {
        allowAccess();
        ClassStudent cs = buildClassStudent(CLASS_ID, STUDENT_ID);
        when(classStudentRepository.findById(new ClassStudentId(CLASS_ID, STUDENT_ID)))
                .thenReturn(Optional.of(cs));
        stubStudentAndClass();
        stubEmptyAttendanceAndAssignments();

        StudentEvaluationRequest req = new StudentEvaluationRequest(
                "Học tốt", bd(8.5), bd(7.0), bd(6.5), bd(9.0));

        StudentEvaluationDto result = service.saveEvaluation(TEACHER_ID, CLASS_ID, STUDENT_ID, req);

        verify(classStudentRepository).save(cs);
        assertThat(cs.getTeacherComment()).isEqualTo("Học tốt");
        assertThat(cs.getSkillHoren()).isEqualByComparingTo(bd(8.5));
        assertThat(result.studentId()).isEqualTo(STUDENT_ID);
    }

    @Test
    @DisplayName("saveEvaluation throws ForbiddenException when teacher does not own class")
    void saveEvaluation_noAccess_throwsForbidden() {
        denyAccess();
        assertThatThrownBy(() -> service.saveEvaluation(TEACHER_ID, CLASS_ID, STUDENT_ID,
                new StudentEvaluationRequest(null, null, null, null, null)))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("saveEvaluation throws NotFoundException when student not in class")
    void saveEvaluation_studentNotInClass_throwsNotFound() {
        allowAccess();
        when(classStudentRepository.findById(any())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.saveEvaluation(TEACHER_ID, CLASS_ID, STUDENT_ID,
                new StudentEvaluationRequest(null, null, null, null, null)))
                .isInstanceOf(NotFoundException.class);
    }

    // ── getEvaluation ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("getEvaluation returns dto with skill scores populated")
    void getEvaluation_withSavedScores_returnsDto() {
        allowAccess();
        ClassStudent cs = buildClassStudent(CLASS_ID, STUDENT_ID);
        cs.setSkillHoren(bd(8.0));
        cs.setSkillLesen(bd(7.5));
        when(classStudentRepository.findById(new ClassStudentId(CLASS_ID, STUDENT_ID)))
                .thenReturn(Optional.of(cs));
        stubStudentAndClass();
        stubEmptyAttendanceAndAssignments();

        StudentEvaluationDto result = service.getEvaluation(TEACHER_ID, CLASS_ID, STUDENT_ID);

        assertThat(result.skillHoren()).isEqualByComparingTo(bd(8.0));
        assertThat(result.skillLesen()).isEqualByComparingTo(bd(7.5));
    }

    // ── getAllEvaluations ─────────────────────────────────────────────────────

    @Test
    @DisplayName("getAllEvaluations returns list sorted by name case-insensitively")
    void getAllEvaluations_multipleStudents_returnsSortedByName() {
        allowAccess();
        ClassStudent csA = buildClassStudent(CLASS_ID, 201L);
        ClassStudent csB = buildClassStudent(CLASS_ID, 202L);
        when(classStudentRepository.findByIdClassId(CLASS_ID)).thenReturn(List.of(csB, csA));

        User userA = buildUser(201L, "Anna", "anna@test.com");
        User userB = buildUser(202L, "Björn", "b@test.com");
        when(userRepository.findById(201L)).thenReturn(Optional.of(userA));
        when(userRepository.findById(202L)).thenReturn(Optional.of(userB));
        when(classRepository.findById(CLASS_ID)).thenReturn(Optional.of(buildClass(CLASS_ID, "A1")));
        when(lessonLogRepository.findByClassIdOrderBySessionDateDesc(CLASS_ID)).thenReturn(List.of());
        when(assignmentRepository.findByClassIdOrderByCreatedAtDesc(CLASS_ID)).thenReturn(List.of());

        List<StudentEvaluationDto> result = service.getAllEvaluations(TEACHER_ID, CLASS_ID);

        assertThat(result).extracting(StudentEvaluationDto::name)
                .containsExactly("Anna", "Björn");
    }

    @Test
    @DisplayName("getAllEvaluations throws ForbiddenException when access denied")
    void getAllEvaluations_noAccess_throwsForbidden() {
        denyAccess();
        assertThatThrownBy(() -> service.getAllEvaluations(TEACHER_ID, CLASS_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    // ── skillReport ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("skillReport uses teacher-entered skill scores over assignment averages")
    void skillReport_manualScoresTakePriority() {
        allowAccess();
        when(classRepository.findById(CLASS_ID)).thenReturn(Optional.of(buildClass(CLASS_ID, "A1")));

        ClassStudent cs = buildClassStudent(CLASS_ID, STUDENT_ID);
        cs.setSkillHoren(bd(9.0));
        cs.setSkillLesen(bd(8.0));
        cs.setSkillSchreiben(bd(7.0));
        cs.setSkillSprechen(bd(6.0));
        when(classStudentRepository.findByIdClassId(CLASS_ID)).thenReturn(List.of(cs));
        when(userRepository.findAllById(List.of(STUDENT_ID)))
                .thenReturn(List.of(buildUser(STUDENT_ID, "Test Student", "t@test.com")));
        when(assignmentRepository.findByClassIdOrderByCreatedAtDesc(CLASS_ID)).thenReturn(List.of());

        SkillReportDto report = service.skillReport(TEACHER_ID, CLASS_ID);

        assertThat(report.className()).isEqualTo("A1");
        assertThat(report.students()).hasSize(1);
        SkillReportDto.StudentSkillRow row = report.students().get(0);
        assertThat(row.horen()).isEqualTo(9.0);
        assertThat(row.lesen()).isEqualTo(8.0);
        assertThat(row.schreiben()).isEqualTo(7.0);
        assertThat(row.sprechen()).isEqualTo(6.0);
        assertThat(row.total()).isEqualTo((9.0 + 8.0 + 7.0 + 6.0) / 4, within(0.001));
    }

    @Test
    @DisplayName("skillReport falls back to assignment averages when no manual scores")
    void skillReport_noManualScores_usesAssignmentAverages() {
        allowAccess();
        when(classRepository.findById(CLASS_ID)).thenReturn(Optional.of(buildClass(CLASS_ID, "A1")));

        ClassStudent cs = buildClassStudent(CLASS_ID, STUDENT_ID);
        when(classStudentRepository.findByIdClassId(CLASS_ID)).thenReturn(List.of(cs));
        when(userRepository.findAllById(any()))
                .thenReturn(List.of(buildUser(STUDENT_ID, "Test Student", "t@test.com")));

        ClassAssignment horenAssignment = buildAssignment(1L, CLASS_ID, "HOREN");
        when(assignmentRepository.findByClassIdOrderByCreatedAtDesc(CLASS_ID))
                .thenReturn(List.of(horenAssignment));

        StudentAssignment sa = new StudentAssignment();
        sa.setAssignmentId(1L);
        sa.setStudentId(STUDENT_ID);
        sa.setScore(8);
        when(studentAssignmentRepository.findByAssignmentIds(List.of(1L))).thenReturn(List.of(sa));

        SkillReportDto report = service.skillReport(TEACHER_ID, CLASS_ID);

        SkillReportDto.StudentSkillRow row = report.students().get(0);
        assertThat(row.horen()).isEqualTo(8.0);
        assertThat(row.lesen()).isNull();
        assertThat(row.schreiben()).isNull();
        assertThat(row.sprechen()).isNull();
    }

    @Test
    @DisplayName("skillReport grade labels map correctly")
    void skillReport_gradeLabels_mapCorrectly() {
        assertThat(SkillReportDto.gradeOf(9.5)).isEqualTo("Xuất sắc");
        assertThat(SkillReportDto.gradeOf(8.0)).isEqualTo("Giỏi");
        assertThat(SkillReportDto.gradeOf(7.0)).isEqualTo("Khá");
        assertThat(SkillReportDto.gradeOf(5.0)).isEqualTo("Trung bình");
        assertThat(SkillReportDto.gradeOf(4.9)).isEqualTo("Yếu");
        assertThat(SkillReportDto.gradeOf(null)).isEqualTo("—");
    }

    @Test
    @DisplayName("skillReport throws ForbiddenException when teacher does not own class")
    void skillReport_noAccess_throwsForbidden() {
        denyAccess();
        assertThatThrownBy(() -> service.skillReport(TEACHER_ID, CLASS_ID))
                .isInstanceOf(ForbiddenException.class);
    }

    // ── certificate eligibility ───────────────────────────────────────────────

    @Test
    @DisplayName("getEvaluation sets certificateEligible true when score >= 5 and attendance >= 80%")
    void getEvaluation_eligibleForCertificate_setsFlag() {
        allowAccess();
        ClassStudent cs = buildClassStudent(CLASS_ID, STUDENT_ID);
        when(classStudentRepository.findById(new ClassStudentId(CLASS_ID, STUDENT_ID)))
                .thenReturn(Optional.of(cs));
        stubStudentAndClass();

        // 5 sessions, 4 present = 80%
        ClassLessonLog log1 = buildLog(1L, CLASS_ID);
        ClassLessonLog log2 = buildLog(2L, CLASS_ID);
        ClassLessonLog log3 = buildLog(3L, CLASS_ID);
        ClassLessonLog log4 = buildLog(4L, CLASS_ID);
        ClassLessonLog log5 = buildLog(5L, CLASS_ID);
        when(lessonLogRepository.findByClassIdOrderBySessionDateDesc(CLASS_ID))
                .thenReturn(List.of(log1, log2, log3, log4, log5));
        when(attendanceRepository.findByLessonLogIds(any())).thenReturn(List.of(
                buildAttendance(1L, STUDENT_ID, "PRESENT"),
                buildAttendance(2L, STUDENT_ID, "PRESENT"),
                buildAttendance(3L, STUDENT_ID, "PRESENT"),
                buildAttendance(4L, STUDENT_ID, "PRESENT"),
                buildAttendance(5L, STUDENT_ID, "ABSENT")));

        // avg score = 6
        ClassAssignment a = buildAssignment(10L, CLASS_ID, "GENERAL");
        when(assignmentRepository.findByClassIdOrderByCreatedAtDesc(CLASS_ID)).thenReturn(List.of(a));
        StudentAssignment sa = new StudentAssignment();
        sa.setAssignmentId(10L);
        sa.setStudentId(STUDENT_ID);
        sa.setScore(6);
        when(studentAssignmentRepository.findByAssignmentIds(List.of(10L))).thenReturn(List.of(sa));

        StudentEvaluationDto result = service.getEvaluation(TEACHER_ID, CLASS_ID, STUDENT_ID);

        assertThat(result.certificateEligible()).isTrue();
        assertThat(result.presentCount()).isEqualTo(4);
        assertThat(result.absentCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("getEvaluation sets certificateEligible false when attendance below 80%")
    void getEvaluation_lowAttendance_notEligible() {
        allowAccess();
        ClassStudent cs = buildClassStudent(CLASS_ID, STUDENT_ID);
        when(classStudentRepository.findById(new ClassStudentId(CLASS_ID, STUDENT_ID)))
                .thenReturn(Optional.of(cs));
        stubStudentAndClass();

        // 5 sessions, only 3 present = 60% < 80%
        when(lessonLogRepository.findByClassIdOrderBySessionDateDesc(CLASS_ID))
                .thenReturn(List.of(buildLog(1L, CLASS_ID), buildLog(2L, CLASS_ID),
                        buildLog(3L, CLASS_ID), buildLog(4L, CLASS_ID), buildLog(5L, CLASS_ID)));
        when(attendanceRepository.findByLessonLogIds(any())).thenReturn(List.of(
                buildAttendance(1L, STUDENT_ID, "PRESENT"),
                buildAttendance(2L, STUDENT_ID, "PRESENT"),
                buildAttendance(3L, STUDENT_ID, "PRESENT"),
                buildAttendance(4L, STUDENT_ID, "ABSENT"),
                buildAttendance(5L, STUDENT_ID, "ABSENT")));
        when(assignmentRepository.findByClassIdOrderByCreatedAtDesc(CLASS_ID)).thenReturn(List.of());

        StudentEvaluationDto result = service.getEvaluation(TEACHER_ID, CLASS_ID, STUDENT_ID);

        assertThat(result.certificateEligible()).isFalse();
    }

    // ── student-facing reads (P4): own-data-only invariant ─────────────────────

    @Test
    @DisplayName("myAttendance rejects a non-member (cannot read another class's attendance)")
    void myAttendance_notEnrolled_throwsNotFound() {
        when(classStudentRepository.existsById(new ClassStudentId(CLASS_ID, STUDENT_ID))).thenReturn(false);

        assertThatThrownBy(() -> service.myAttendance(STUDENT_ID, CLASS_ID))
                .isInstanceOf(NotFoundException.class);
        verifyNoInteractions(lessonLogRepository, attendanceRepository);
    }

    @Test
    @DisplayName("mySkillReport rejects a non-member")
    void mySkillReport_notEnrolled_throwsNotFound() {
        when(classStudentRepository.existsById(new ClassStudentId(CLASS_ID, STUDENT_ID))).thenReturn(false);

        assertThatThrownBy(() -> service.mySkillReport(STUDENT_ID, CLASS_ID))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("myAttendance returns only the caller's rows; unmarked sessions are null, never another student's status")
    void myAttendance_returnsOnlyOwnRows() {
        final Long OTHER = 999L;
        when(classStudentRepository.existsById(new ClassStudentId(CLASS_ID, STUDENT_ID))).thenReturn(true);
        when(lessonLogRepository.findByClassIdOrderBySessionDateDesc(CLASS_ID))
                .thenReturn(List.of(buildLog(1L, CLASS_ID), buildLog(2L, CLASS_ID)));
        when(attendanceRepository.findByLessonLogIds(any())).thenReturn(List.of(
                buildAttendance(1L, STUDENT_ID, "PRESENT"),
                buildAttendance(1L, OTHER, "ABSENT")));   // another student's row must be ignored

        var rows = service.myAttendance(STUDENT_ID, CLASS_ID);

        assertThat(rows).hasSize(2);
        assertThat(rows).noneMatch(r -> "ABSENT".equals(r.status()));      // never leak OTHER's status
        assertThat(rows).filteredOn(r -> r.lessonLogId().equals(1L))
                .singleElement().extracting(r -> r.status()).isEqualTo("PRESENT");
        assertThat(rows).filteredOn(r -> r.lessonLogId().equals(2L))
                .singleElement().extracting(r -> r.status()).isNull();     // unmarked → null
    }

    @Test
    @DisplayName("mySkillReport averages only the caller's own skill-tagged assignment scores")
    void mySkillReport_usesOnlyOwnScores() {
        final Long OTHER = 999L;
        when(classStudentRepository.existsById(new ClassStudentId(CLASS_ID, STUDENT_ID))).thenReturn(true);
        when(classStudentRepository.findById(new ClassStudentId(CLASS_ID, STUDENT_ID)))
                .thenReturn(Optional.of(buildClassStudent(CLASS_ID, STUDENT_ID)));   // no manual scores
        when(assignmentRepository.findByClassIdOrderByCreatedAtDesc(CLASS_ID))
                .thenReturn(List.of(buildAssignment(1L, CLASS_ID, "HOREN")));

        StudentAssignment mine = new StudentAssignment();
        mine.setAssignmentId(1L); mine.setStudentId(STUDENT_ID); mine.setScore(8);
        StudentAssignment other = new StudentAssignment();
        other.setAssignmentId(1L); other.setStudentId(OTHER); other.setScore(2);   // must NOT count
        when(studentAssignmentRepository.findByAssignmentIds(List.of(1L)))
                .thenReturn(List.of(mine, other));

        var report = service.mySkillReport(STUDENT_ID, CLASS_ID);

        assertThat(report.horen()).isEqualTo(8.0);   // 8 only, not (8+2)/2
        assertThat(report.lesen()).isNull();
        assertThat(report.total()).isEqualTo(8.0);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private void allowAccess() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(true);
    }

    private void denyAccess() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, TEACHER_ID)).thenReturn(false);
    }

    private void stubStudentAndClass() {
        when(userRepository.findById(STUDENT_ID))
                .thenReturn(Optional.of(buildUser(STUDENT_ID, "Test Student", "t@test.com")));
        when(classRepository.findById(CLASS_ID))
                .thenReturn(Optional.of(buildClass(CLASS_ID, "A1")));
    }

    private void stubEmptyAttendanceAndAssignments() {
        when(lessonLogRepository.findByClassIdOrderBySessionDateDesc(CLASS_ID)).thenReturn(List.of());
        when(assignmentRepository.findByClassIdOrderByCreatedAtDesc(CLASS_ID)).thenReturn(List.of());
    }

    private static ClassStudent buildClassStudent(Long classId, Long studentId) {
        ClassStudent cs = new ClassStudent();
        cs.setId(new ClassStudentId(classId, studentId));
        return cs;
    }

    private static User buildUser(Long id, String name, String email) {
        User u = new User();
        u.setId(id);
        u.setDisplayName(name);
        u.setEmail(email);
        return u;
    }

    private static TeacherClass buildClass(Long id, String name) {
        TeacherClass cls = new TeacherClass();
        cls.setId(id);
        cls.setName(name);
        return cls;
    }

    private static ClassLessonLog buildLog(Long id, Long classId) {
        ClassLessonLog log = ClassLessonLog.builder()
                .classId(classId)
                .sessionDate(LocalDate.now())
                .createdBy(TEACHER_ID)
                .build();
        log.setId(id);
        log.setCreatedAt(LocalDateTime.now());
        return log;
    }

    private static ClassAttendance buildAttendance(Long logId, Long studentId, String status) {
        return ClassAttendance.builder()
                .id(new ClassAttendanceId(logId, studentId))
                .status(status)
                .build();
    }

    private static ClassAssignment buildAssignment(Long id, Long classId, String skill) {
        ClassAssignment a = new ClassAssignment();
        a.setId(id);
        a.setClassId(classId);
        a.setTopic("Test assignment");
        a.setSkill(skill);
        return a;
    }

    private static BigDecimal bd(double v) {
        return BigDecimal.valueOf(v);
    }
}
