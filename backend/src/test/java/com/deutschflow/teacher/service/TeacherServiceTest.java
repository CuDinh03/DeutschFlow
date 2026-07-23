package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.speaking.service.SpeakingAiHelpersService;
import com.deutschflow.teacher.dto.ClassAssignmentDto;
import com.deutschflow.teacher.dto.ClassTeacherDto;
import com.deutschflow.teacher.dto.CreateAssignmentRequest;
import com.deutschflow.teacher.dto.StudentAssignmentDto;
import com.deutschflow.teacher.entity.AssignmentScenario;
import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.ClassLesson;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.ClassTeacherId;
import com.deutschflow.teacher.entity.StudentAssignment;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.AssignmentScenarioRepository;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.ClassroomJoinRequestRepository;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.repository.UserRepository;
import com.deutschflow.gamification.service.XpService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TeacherServiceTest {

    @Mock
    private TeacherClassRepository classRepository;

    @Mock
    private ClassStudentRepository classStudentRepository;

    @Mock
    private ClassTeacherRepository classTeacherRepository;

    @Mock
    private ClassAssignmentRepository assignmentRepository;

    @Mock
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Mock
    private StudentAssignmentRepository studentAssignmentRepository;

    @Mock
    private com.deutschflow.speaking.repository.AiSpeakingSessionRepository speakingSessionRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserLearningProfileRepository profileRepository;

    @Mock
    private com.deutschflow.speaking.repository.UserGrammarErrorRepository grammarErrorRepository;

    @Mock
    private ClassroomJoinRequestRepository joinRequestRepository;

    @Mock
    private XpService xpService;

    @Mock
    private UserNotificationService userNotificationService;

    @Mock
    private SpeakingAiHelpersService speakingAiHelpersService;

    @Mock
    private AssignmentScenarioRepository assignmentScenarioRepository;

    @Mock
    private S3StorageService s3StorageService;

    @Mock
    private com.deutschflow.teacher.repository.ClassLessonRepository lessonRepository;

    @Mock
    private StudentCompetencyService studentCompetencyService;

    @Mock
    private com.deutschflow.material.service.MaterialService materialService;

    @Mock
    private AssignmentBackfillService assignmentBackfillService;

    @Mock
    private com.deutschflow.notification.service.NotificationAutoAckService notificationAutoAckService;

    @Mock
    private com.deutschflow.common.transaction.RunAfterCommitService runAfterCommitService;

    private TeacherService teacherService;

    @BeforeEach
    void setUp() {
        teacherService = new TeacherService(
                classRepository,
                classStudentRepository,
                classTeacherRepository,
                assignmentRepository,
                assignmentBackfillService,
                jdbcTemplate,
                studentAssignmentRepository,
                speakingSessionRepository,
                userRepository,
                profileRepository,
                grammarErrorRepository,
                joinRequestRepository,
                xpService,
                userNotificationService,
                speakingAiHelpersService,
                assignmentScenarioRepository,
                s3StorageService,
                lessonRepository,
                studentCompetencyService,
                materialService,
                notificationAutoAckService,
                runAfterCommitService
        );
    }

    @Test
    void createAssignment_Success() {
        Long teacherId = 1L;
        Long classId = 100L;
        CreateAssignmentRequest req = new CreateAssignmentRequest("Test Topic", "Test Desc", "GENERAL", null, 10L, LocalDateTime.now().plusDays(7), null, null, null);

        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)).thenReturn(true);

        TeacherClass teacherClass = TeacherClass.builder().id(classId).name("Class A").build();
        when(classRepository.findById(classId)).thenReturn(java.util.Optional.of(teacherClass));
        when(userRepository.findById(teacherId)).thenReturn(java.util.Optional.empty());

        ClassAssignment savedAssignment = ClassAssignment.builder().id(500L).classId(classId).topic("Test Topic").build();
        when(assignmentRepository.save(any(ClassAssignment.class))).thenReturn(savedAssignment);

        ClassStudent student1 = ClassStudent.builder().id(new ClassStudentId(classId, 200L)).build();
        ClassStudent student2 = ClassStudent.builder().id(new ClassStudentId(classId, 201L)).build();
        when(classStudentRepository.findByIdClassId(classId)).thenReturn(List.of(student1, student2));

        ClassAssignmentDto dto = teacherService.createAssignment(teacherId, classId, req);

        assertNotNull(dto);
        assertEquals(500L, dto.id());

        ArgumentCaptor<List<StudentAssignment>> listCaptor = ArgumentCaptor.forClass(List.class);
        verify(studentAssignmentRepository).saveAll(listCaptor.capture());

        List<StudentAssignment> capturedAssignments = listCaptor.getValue();
        assertEquals(2, capturedAssignments.size());
        assertEquals("PENDING", capturedAssignments.get(0).getStatus());
        assertEquals(200L, capturedAssignments.get(0).getStudentId());
        assertEquals(500L, capturedAssignments.get(0).getAssignmentId());
    }

    @Test
    void createAssignment_lessonFromOtherClass_throwsForbidden() {
        Long teacherId = 1L, classId = 100L, lessonId = 55L;
        CreateAssignmentRequest req = new CreateAssignmentRequest(
                "T", "D", "GENERAL", null, null, null, null, lessonId, null);

        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)).thenReturn(true);
        when(lessonRepository.findById(lessonId)).thenReturn(Optional.of(
                ClassLesson.builder().id(lessonId).classId(999L).orderIndex(0).title("Fremd").build()));

        assertThrows(ForbiddenException.class, () -> teacherService.createAssignment(teacherId, classId, req));
        verify(assignmentRepository, never()).save(any());
    }

    @Test
    void createAssignment_withValidLesson_setsLessonId() {
        Long teacherId = 1L, classId = 100L, lessonId = 55L;
        CreateAssignmentRequest req = new CreateAssignmentRequest(
                "T", "D", "GENERAL", null, null, null, null, lessonId, null);

        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)).thenReturn(true);
        when(lessonRepository.findById(lessonId)).thenReturn(Optional.of(
                ClassLesson.builder().id(lessonId).classId(classId).orderIndex(0).title("Lektion 5").build()));
        when(classRepository.findById(classId)).thenReturn(Optional.of(
                TeacherClass.builder().id(classId).name("Class A").build()));
        when(userRepository.findById(teacherId)).thenReturn(Optional.empty());
        when(classStudentRepository.findByIdClassId(classId)).thenReturn(List.of());
        ClassAssignment saved = ClassAssignment.builder()
                .id(500L).classId(classId).lessonId(lessonId).topic("T").build();
        when(assignmentRepository.save(any(ClassAssignment.class))).thenReturn(saved);

        ClassAssignmentDto dto = teacherService.createAssignment(teacherId, classId, req);

        assertEquals(lessonId, dto.lessonId());
        ArgumentCaptor<ClassAssignment> captor = ArgumentCaptor.forClass(ClassAssignment.class);
        verify(assignmentRepository).save(captor.capture());
        assertEquals(lessonId, captor.getValue().getLessonId());
    }

    /**
     * The audit bug: a SPEAKING_SCENARIO was always generated at a hardcoded "A2", so a B1/B2 class got
     * an A2 scenario. When the assignment links a lesson, the lesson's CEFR level is used instead.
     */
    @Test
    void createAssignment_speakingScenario_usesLinkedLessonCefrLevel() {
        Long teacherId = 1L, classId = 100L, lessonId = 55L;
        CreateAssignmentRequest req = new CreateAssignmentRequest(
                "Im Restaurant", "D", "SPEAKING_SCENARIO", null, null, null, null, lessonId, null);

        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)).thenReturn(true);
        when(lessonRepository.findById(lessonId)).thenReturn(Optional.of(
                ClassLesson.builder().id(lessonId).classId(classId).orderIndex(0).title("L5").cefrLevel("B1").build()));
        when(assignmentRepository.save(any(ClassAssignment.class))).thenAnswer(inv -> {
            ClassAssignment a = inv.getArgument(0);
            if (a.getId() == null) a.setId(500L);
            return a;
        });
        when(classStudentRepository.findByIdClassId(classId)).thenReturn(List.of());
        when(speakingAiHelpersService.generateScenario(eq(teacherId), anyString(), anyString()))
                .thenReturn(com.deutschflow.speaking.service.SpeakingAiHelpersService.PracticeScenario.builder().build());

        teacherService.createAssignment(teacherId, classId, req);

        // B1, taken from the linked lesson — NOT the old hardcoded "A2".
        verify(speakingAiHelpersService).generateScenario(eq(teacherId), eq("Im Restaurant"), eq("B1"));
        verify(speakingAiHelpersService, never()).generateScenario(any(), anyString(), eq("A2"));
    }

    @Test
    void createAssignment_speakingScenario_noLesson_fallsBackToA2() {
        Long teacherId = 1L, classId = 100L;
        CreateAssignmentRequest req = new CreateAssignmentRequest(
                "Smalltalk", "D", "SPEAKING_SCENARIO", null, null, null, null, null, null);

        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)).thenReturn(true);
        when(assignmentRepository.save(any(ClassAssignment.class))).thenAnswer(inv -> {
            ClassAssignment a = inv.getArgument(0);
            if (a.getId() == null) a.setId(501L);
            return a;
        });
        when(classStudentRepository.findByIdClassId(classId)).thenReturn(List.of());
        when(speakingAiHelpersService.generateScenario(eq(teacherId), anyString(), anyString()))
                .thenReturn(com.deutschflow.speaking.service.SpeakingAiHelpersService.PracticeScenario.builder().build());

        teacherService.createAssignment(teacherId, classId, req);

        verify(speakingAiHelpersService).generateScenario(eq(teacherId), eq("Smalltalk"), eq("A2"));
    }

    // ── class analytics: real completedAssignments, honest nulls (wave 4 §5.2) ────

    @Test
    void getClassAnalytics_completedAssignments_countsConfirmedGradesOnly() {
        Long teacherId = 1L, classId = 100L;
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)).thenReturn(true);
        when(classStudentRepository.findByIdClassId(classId)).thenReturn(List.of(
                ClassStudent.builder().id(new ClassStudentId(classId, 10L)).build()));
        when(xpService.totalXpForUsers(any())).thenReturn(0L);
        when(grammarErrorRepository.aggregateErrorCodesForUsers(any(), any())).thenReturn(List.of());
        when(assignmentRepository.findByClassIdOrderByCreatedAtDesc(classId)).thenReturn(List.of(
                ClassAssignment.builder().id(900L).classId(classId).build()));
        when(studentAssignmentRepository.findByAssignmentIds(List.of(900L))).thenReturn(List.of(
                StudentAssignment.builder().id(1L).assignmentId(900L).studentId(10L).status("EVALUATED").score(80).build(),
                StudentAssignment.builder().id(2L).assignmentId(900L).studentId(10L).status("AI_GRADED").score(70).build(),
                StudentAssignment.builder().id(3L).assignmentId(900L).studentId(10L).status("SUBMITTED").build()));

        var dto = teacherService.getClassAnalytics(teacherId, classId);

        // Only the EVALUATED row is a confirmed grade — AI_GRADED (proposal) and SUBMITTED don't count.
        assertEquals(1L, dto.completedAssignments());
        // No honest class-scoped source for these → null, so the UI hides the card (not a fake 0).
        org.junit.jupiter.api.Assertions.assertNull(dto.avgSpeakingScore());
        org.junit.jupiter.api.Assertions.assertNull(dto.reviewCoveragePct());
    }

    // ── roster CEFR = current level, not the self-declared target (wave 4 §5.1) ───

    @Test
    void getClassStudents_cefrColumnIsCurrentLevel_targetShownSeparately() {
        Long teacherId = 1L, classId = 100L, studentId = 10L;
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)).thenReturn(true);
        when(classStudentRepository.findByIdClassId(classId)).thenReturn(List.of(
                ClassStudent.builder().id(new ClassStudentId(classId, studentId)).build()));
        var user = com.deutschflow.user.entity.User.builder().id(studentId).displayName("Hiệp").email("h@x.com").build();
        when(userRepository.findAllById(List.of(studentId))).thenReturn(List.of(user));
        var profile = com.deutschflow.user.entity.UserLearningProfile.builder()
                .user(user)
                .currentLevel(com.deutschflow.user.entity.UserLearningProfile.CurrentLevel.A1)
                .targetLevel(com.deutschflow.user.entity.UserLearningProfile.TargetLevel.B2)
                .levelSource("SELF")
                .build();
        when(profileRepository.findByUserIdIn(List.of(studentId))).thenReturn(List.of(profile));
        when(xpService.totalXpByUserId(List.of(studentId))).thenReturn(java.util.Map.of(studentId, 0));

        var rows = teacherService.getClassStudents(teacherId, classId);

        // A beginner heading for B2 must read as A1 now — NOT B2 (which the old code showed, so a teacher
        // could think they were already advanced).
        assertEquals("A1", rows.get(0).cefrLevel());
        assertEquals("B2", rows.get(0).targetLevel());
        assertEquals("SELF", rows.get(0).levelSource());
    }

    @Test
    void getStudentAssignments_Success() {
        Long teacherId = 1L;
        Long studentId = 200L;

        ClassTeacher ct = ClassTeacher.builder().id(new ClassTeacherId(100L, teacherId)).build();
        when(classTeacherRepository.findByIdTeacherId(teacherId)).thenReturn(List.of(ct));
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(100L, studentId)).thenReturn(true);

        // The read is scoped to the assignments of the shared class, not to the student globally.
        when(assignmentRepository.findByClassIdIn(List.of(100L)))
                .thenReturn(List.of(ClassAssignment.builder().id(500L).classId(100L).build()));

        StudentAssignment sa = StudentAssignment.builder()
                .id(1L).assignmentId(500L).studentId(studentId).status("SUBMITTED").score(90).feedback("Good")
                .build();

        when(studentAssignmentRepository
                .findByStudentIdAndAssignmentIdInAndDeletedFalseOrderByCreatedAtDesc(studentId, List.of(500L)))
                .thenReturn(List.of(sa));

        List<StudentAssignmentDto> result = teacherService.getStudentAssignments(teacherId, studentId);

        assertEquals(1, result.size());
        assertEquals(90, result.get(0).teacherScore());
        assertEquals("SUBMITTED", result.get(0).status());
    }

    // ─── M-17: org-supervision reads (roster + teacher-classes theo org) ─────────

    @Test
    @DisplayName("M-17: getClassStudentsForOrg — lớp của org khác → NotFound, không đọc roster")
    void getClassStudentsForOrg_crossOrg_throwsNotFound() {
        com.deutschflow.teacher.entity.TeacherClass tc =
                org.mockito.Mockito.mock(com.deutschflow.teacher.entity.TeacherClass.class);
        org.mockito.Mockito.when(tc.getOrgId()).thenReturn(7L);
        org.mockito.Mockito.when(classRepository.findById(10L))
                .thenReturn(java.util.Optional.of(tc));

        org.junit.jupiter.api.Assertions.assertThrows(
                com.deutschflow.common.exception.NotFoundException.class,
                () -> teacherService.getClassStudentsForOrg(999L, 10L));
        org.mockito.Mockito.verify(classStudentRepository, org.mockito.Mockito.never())
                .findByIdClassId(org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("M-17: getClassesForTeacherInOrg — chỉ trả lớp thuộc org caller, lớp org khác vắng mặt")
    void getClassesForTeacherInOrg_filtersToCallerOrg() {
        com.deutschflow.teacher.entity.ClassTeacher linkA = org.mockito.Mockito.mock(
                com.deutschflow.teacher.entity.ClassTeacher.class, org.mockito.Mockito.RETURNS_DEEP_STUBS);
        com.deutschflow.teacher.entity.ClassTeacher linkB = org.mockito.Mockito.mock(
                com.deutschflow.teacher.entity.ClassTeacher.class, org.mockito.Mockito.RETURNS_DEEP_STUBS);
        org.mockito.Mockito.when(linkA.getId().getClassId()).thenReturn(1L);
        org.mockito.Mockito.when(linkB.getId().getClassId()).thenReturn(2L);
        org.mockito.Mockito.when(classTeacherRepository.findByIdTeacherId(5L))
                .thenReturn(java.util.List.of(linkA, linkB));

        com.deutschflow.teacher.entity.TeacherClass inOrg =
                org.mockito.Mockito.mock(com.deutschflow.teacher.entity.TeacherClass.class);
        org.mockito.Mockito.when(inOrg.getId()).thenReturn(1L);
        org.mockito.Mockito.when(inOrg.getOrgId()).thenReturn(7L);
        com.deutschflow.teacher.entity.TeacherClass otherOrg =
                org.mockito.Mockito.mock(com.deutschflow.teacher.entity.TeacherClass.class);
        org.mockito.Mockito.when(otherOrg.getOrgId()).thenReturn(8L);
        // Lượt 1: lọc theo org trên cả hai lớp; lượt 2 (buildClassDtos): chỉ còn lớp trong org.
        org.mockito.Mockito.when(classRepository.findAllById(org.mockito.ArgumentMatchers.anyList()))
                .thenReturn(java.util.List.of(inOrg, otherOrg))
                .thenReturn(java.util.List.of(inOrg));
        org.mockito.Mockito.when(jdbcTemplate.queryForList(
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.<Object[]>any()))
                .thenReturn(java.util.List.of());

        var result = teacherService.getClassesForTeacherInOrg(7L, 5L);

        org.assertj.core.api.Assertions.assertThat(result).hasSize(1);
        org.assertj.core.api.Assertions.assertThat(result.get(0).id()).isEqualTo(1L);
    }

    // ─── IDOR guards: class-scoped reads must verify teacher owns the class ──────

    @Test
    void getClassAssignments_throwsForbidden_whenTeacherDoesNotOwnClass() {
        Long teacherId = 1L, classId = 100L;
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)).thenReturn(false);

        assertThrows(ForbiddenException.class,
                () -> teacherService.getClassAssignments(teacherId, classId));
        verify(assignmentRepository, never()).findByClassIdOrderByCreatedAtDesc(any());
    }

    @Test
    void getClassAssignments_returnsAssignments_whenTeacherOwnsClass() {
        Long teacherId = 1L, classId = 100L;
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)).thenReturn(true);
        when(assignmentRepository.findByClassIdOrderByCreatedAtDesc(classId)).thenReturn(List.of(
                ClassAssignment.builder().id(500L).classId(classId).topic("Test Topic").build()));

        List<ClassAssignmentDto> result = teacherService.getClassAssignments(teacherId, classId);

        assertEquals(1, result.size());
        assertEquals(500L, result.get(0).id());
    }

    @Test
    void assertTeacherOwnsClass_throwsForbidden_whenNotOwner() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(100L, 1L)).thenReturn(false);

        assertThrows(ForbiddenException.class,
                () -> teacherService.assertTeacherOwnsClass(1L, 100L));
    }

    @Test
    void assertTeacherOwnsClass_passes_whenOwner() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(100L, 1L)).thenReturn(true);

        teacherService.assertTeacherOwnsClass(1L, 100L); // must not throw
    }

    // ─── Co-teaching: quản lý giáo viên trong lớp ────────────────────────────────

    @Test
    void getClassTeachers_throwsForbidden_whenCallerNotInClass() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(100L, 1L)).thenReturn(false);

        assertThrows(ForbiddenException.class, () -> teacherService.getClassTeachers(1L, 100L));
    }

    @Test
    void getClassTeachers_returnsPrimaryFirst() {
        Long classId = 100L;
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, 1L)).thenReturn(true);
        when(classTeacherRepository.findByIdClassId(classId)).thenReturn(List.of(
                ClassTeacher.builder().id(new ClassTeacherId(classId, 2L)).role("ASSISTANT").build(),
                ClassTeacher.builder().id(new ClassTeacherId(classId, 1L)).role("PRIMARY").build()));
        when(userRepository.findAllById(List.of(2L, 1L))).thenReturn(List.of(
                com.deutschflow.user.entity.User.builder().id(1L).displayName("Chính").email("p@x.de").build(),
                com.deutschflow.user.entity.User.builder().id(2L).displayName("Phụ").email("a@x.de").build()));

        List<ClassTeacherDto> result = teacherService.getClassTeachers(1L, classId);

        assertEquals(2, result.size());
        assertEquals("PRIMARY", result.get(0).role());
        assertEquals("Chính", result.get(0).name());
        assertEquals("ASSISTANT", result.get(1).role());
    }

    @Test
    void addCoTeacher_throwsForbidden_whenCallerIsAssistant() {
        when(classTeacherRepository.findById(new ClassTeacherId(100L, 1L))).thenReturn(java.util.Optional.of(
                ClassTeacher.builder().id(new ClassTeacherId(100L, 1L)).role("ASSISTANT").build()));

        assertThrows(ForbiddenException.class,
                () -> teacherService.addCoTeacher(1L, 100L, "x@y.de"));
        verify(classTeacherRepository, never()).save(any());
    }

    @Test
    void addCoTeacher_throwsBadRequest_whenTargetIsStudent() {
        when(classTeacherRepository.findById(new ClassTeacherId(100L, 1L))).thenReturn(java.util.Optional.of(
                ClassTeacher.builder().id(new ClassTeacherId(100L, 1L)).role("PRIMARY").build()));
        when(userRepository.findByEmailIgnoreCase("s@y.de")).thenReturn(java.util.Optional.of(
                com.deutschflow.user.entity.User.builder().id(5L)
                        .role(com.deutschflow.user.entity.User.Role.STUDENT).build()));

        assertThrows(com.deutschflow.common.exception.BadRequestException.class,
                () -> teacherService.addCoTeacher(1L, 100L, "s@y.de"));
        verify(classTeacherRepository, never()).save(any());
    }

    // ── org isolation khi thêm học viên (N-1) ─────────────────────────────────

    /**
     * Roster là biên tin cậy mà điểm danh/đánh giá/chứng chỉ đều dựa vào. Nếu giáo viên thêm được
     * người ngoài tổ chức vào lớp mình, họ tự tạo ra "thành viên hợp lệ" và mọi guard dựa trên
     * roster đều bị vô hiệu. Quy tắc mirror đúng addCoTeacher.
     */
    @Test
    void addStudentByEmail_rejectsUserFromAnotherOrg() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(100L, 1L)).thenReturn(true);
        when(userRepository.findByEmailIgnoreCase("outsider@other.de")).thenReturn(java.util.Optional.of(
                com.deutschflow.user.entity.User.builder().id(9001L).orgId(77L)
                        .role(com.deutschflow.user.entity.User.Role.STUDENT).build()));
        when(classRepository.findById(100L)).thenReturn(Optional.of(
                TeacherClass.builder().id(100L).orgId(42L).build()));   // lớp thuộc org 42

        assertThrows(com.deutschflow.common.exception.BadRequestException.class,
                () -> teacherService.addStudentToClassByEmail(1L, 100L, "outsider@other.de"));
        verify(classStudentRepository, never()).save(any());
    }

    @Test
    void addStudentByEmail_allowsSameOrg() {
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(100L, 1L)).thenReturn(true);
        when(userRepository.findByEmailIgnoreCase("hv@org.de")).thenReturn(java.util.Optional.of(
                com.deutschflow.user.entity.User.builder().id(5L).orgId(42L)
                        .role(com.deutschflow.user.entity.User.Role.STUDENT).build()));
        when(classRepository.findById(100L)).thenReturn(Optional.of(
                TeacherClass.builder().id(100L).orgId(42L).build()));
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(100L, 5L)).thenReturn(false);

        teacherService.addStudentToClassByEmail(1L, 100L, "hv@org.de");

        verify(classStudentRepository).save(any());
    }

    @Test
    void addStudentByEmail_personalClassHasNoOrgRestriction() {
        // Lớp cá nhân (orgId = null) giữ nguyên hành vi cũ — không áp ràng buộc tổ chức.
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(100L, 1L)).thenReturn(true);
        when(userRepository.findByEmailIgnoreCase("hv@bat-ky.de")).thenReturn(java.util.Optional.of(
                com.deutschflow.user.entity.User.builder().id(6L).orgId(77L)
                        .role(com.deutschflow.user.entity.User.Role.STUDENT).build()));
        when(classRepository.findById(100L)).thenReturn(Optional.of(
                TeacherClass.builder().id(100L).build()));              // orgId = null
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(100L, 6L)).thenReturn(false);

        teacherService.addStudentToClassByEmail(1L, 100L, "hv@bat-ky.de");

        verify(classStudentRepository).save(any());
    }

    @Test
    void addCoTeacher_savesAssistant_whenValid() {
        when(classTeacherRepository.findById(new ClassTeacherId(100L, 1L))).thenReturn(java.util.Optional.of(
                ClassTeacher.builder().id(new ClassTeacherId(100L, 1L)).role("PRIMARY").build()));
        when(userRepository.findByEmailIgnoreCase("t@y.de")).thenReturn(java.util.Optional.of(
                com.deutschflow.user.entity.User.builder().id(7L)
                        .role(com.deutschflow.user.entity.User.Role.TEACHER).build()));
        when(classRepository.findById(100L)).thenReturn(Optional.of(
                TeacherClass.builder().id(100L).build()));  // orgId=null → no org restriction
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(100L, 7L)).thenReturn(false);

        teacherService.addCoTeacher(1L, 100L, "t@y.de");

        ArgumentCaptor<ClassTeacher> captor = ArgumentCaptor.forClass(ClassTeacher.class);
        verify(classTeacherRepository).save(captor.capture());
        assertEquals("ASSISTANT", captor.getValue().getRole());
        assertEquals(7L, captor.getValue().getId().getTeacherId());
    }

    @Test
    void addCoTeacher_trimsEmailAndUsesCaseInsensitiveLookup() {
        // The teacher may type the co-teacher's address with surrounding spaces / any case. The
        // service trims and delegates to findByEmailIgnoreCase (the repo matches upper(email)),
        // so a stray space or capital letter no longer yields "không tìm thấy người dùng".
        when(classTeacherRepository.findById(new ClassTeacherId(100L, 1L))).thenReturn(java.util.Optional.of(
                ClassTeacher.builder().id(new ClassTeacherId(100L, 1L)).role("PRIMARY").build()));
        when(userRepository.findByEmailIgnoreCase("T@Y.de")).thenReturn(java.util.Optional.of(
                com.deutschflow.user.entity.User.builder().id(7L)
                        .role(com.deutschflow.user.entity.User.Role.TEACHER).build()));
        when(classRepository.findById(100L)).thenReturn(Optional.of(
                TeacherClass.builder().id(100L).build()));  // orgId=null → no org restriction
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(100L, 7L)).thenReturn(false);

        teacherService.addCoTeacher(1L, 100L, "  T@Y.de  ");

        verify(userRepository).findByEmailIgnoreCase("T@Y.de"); // trimmed (case preserved → repo is case-insensitive)
        verify(classTeacherRepository).save(any());
    }

    @Test
    void addCoTeacher_blankEmail_throwsBadRequest_noLookupNoLeak() {
        // A null/blank email must fail fast with a clear message — not pass null to the repo and
        // surface "với email: null" to the client.
        when(classTeacherRepository.findById(new ClassTeacherId(100L, 1L))).thenReturn(java.util.Optional.of(
                ClassTeacher.builder().id(new ClassTeacherId(100L, 1L)).role("PRIMARY").build()));

        assertThrows(com.deutschflow.common.exception.BadRequestException.class,
                () -> teacherService.addCoTeacher(1L, 100L, "   "));
        verify(userRepository, never()).findByEmailIgnoreCase(anyString());
        verify(classTeacherRepository, never()).save(any());
    }

    @Test
    void removeCoTeacher_throwsBadRequest_whenTargetIsPrimary() {
        when(classTeacherRepository.findById(new ClassTeacherId(100L, 1L))).thenReturn(java.util.Optional.of(
                ClassTeacher.builder().id(new ClassTeacherId(100L, 1L)).role("PRIMARY").build()));
        when(classTeacherRepository.findById(new ClassTeacherId(100L, 1L))).thenReturn(java.util.Optional.of(
                ClassTeacher.builder().id(new ClassTeacherId(100L, 1L)).role("PRIMARY").build()));

        assertThrows(com.deutschflow.common.exception.BadRequestException.class,
                () -> teacherService.removeCoTeacher(1L, 100L, 1L));
        verify(classTeacherRepository, never()).delete(any(ClassTeacher.class));
    }

    @Test
    void removeCoTeacher_deletesAssistant() {
        when(classTeacherRepository.findById(new ClassTeacherId(100L, 1L))).thenReturn(java.util.Optional.of(
                ClassTeacher.builder().id(new ClassTeacherId(100L, 1L)).role("PRIMARY").build()));
        ClassTeacher assistant = ClassTeacher.builder()
                .id(new ClassTeacherId(100L, 7L)).role("ASSISTANT").build();
        when(classTeacherRepository.findById(new ClassTeacherId(100L, 7L)))
                .thenReturn(java.util.Optional.of(assistant));

        teacherService.removeCoTeacher(1L, 100L, 7L);

        verify(classTeacherRepository).delete(assistant);
    }

    @Test
    void deleteClass_throwsForbidden_whenCallerIsAssistant() {
        when(classTeacherRepository.findById(new ClassTeacherId(100L, 1L))).thenReturn(java.util.Optional.of(
                ClassTeacher.builder().id(new ClassTeacherId(100L, 1L)).role("ASSISTANT").build()));

        assertThrows(ForbiddenException.class, () -> teacherService.deleteClass(1L, 100L));
        verify(classRepository, never()).deleteById(any());
    }

    // ─── getOrCreateScenarioForStudent (lazy speaking-scenario recovery) ─────────

    @Test
    void getOrCreateScenario_returnsExisting_withoutLlmCall() {
        Long assignmentId = 500L, studentId = 200L;
        when(studentAssignmentRepository.findByStudentIdAndAssignmentId(studentId, assignmentId))
                .thenReturn(java.util.Optional.of(StudentAssignment.builder().id(1L).build()));
        AssignmentScenario existing = AssignmentScenario.builder()
                .id(9L).assignmentId(assignmentId).topic("Gia đình").level("A2").build();
        when(assignmentScenarioRepository.findFirstByAssignmentIdOrderByIdAsc(assignmentId))
                .thenReturn(java.util.Optional.of(existing));

        AssignmentScenario result = teacherService.getOrCreateScenarioForStudent(assignmentId, studentId);

        assertEquals(9L, result.getId());
        verify(speakingAiHelpersService, never()).generateScenario(any(Long.class), anyString(), anyString());
        verify(assignmentScenarioRepository, never()).save(any());
    }

    @Test
    void getOrCreateScenario_lazilyGeneratesAndBackfillsReferenceId_whenMissing() {
        Long assignmentId = 500L, studentId = 200L;
        when(studentAssignmentRepository.findByStudentIdAndAssignmentId(studentId, assignmentId))
                .thenReturn(java.util.Optional.of(StudentAssignment.builder().id(1L).build()));
        when(assignmentScenarioRepository.findFirstByAssignmentIdOrderByIdAsc(assignmentId))
                .thenReturn(java.util.Optional.empty());
        ClassAssignment ca = ClassAssignment.builder()
                .id(assignmentId).topic("Nói về gia đình").assignmentType("SPEAKING_SCENARIO").build();
        when(assignmentRepository.findById(assignmentId)).thenReturn(java.util.Optional.of(ca));
        when(speakingAiHelpersService.generateScenario(studentId, "Nói về gia đình", "A2")).thenReturn(
                SpeakingAiHelpersService.PracticeScenario.builder()
                        .topic("Nói về gia đình").level("A2")
                        .scenarioDescription("desc").followUpQuestions("q").build());
        when(assignmentScenarioRepository.save(any(AssignmentScenario.class))).thenAnswer(inv -> {
            AssignmentScenario s = inv.getArgument(0);
            s.setId(42L);
            return s;
        });

        AssignmentScenario result = teacherService.getOrCreateScenarioForStudent(assignmentId, studentId);

        assertEquals(42L, result.getId());
        assertEquals("Nói về gia đình", result.getTopic());
        // referenceId must be back-filled on the assignment so future loads short-circuit.
        ArgumentCaptor<ClassAssignment> caCaptor = ArgumentCaptor.forClass(ClassAssignment.class);
        verify(assignmentRepository).save(caCaptor.capture());
        assertEquals(42L, caCaptor.getValue().getReferenceId());
    }

    @Test
    void getOrCreateScenario_throwsNotFound_whenStudentNotAssigned() {
        when(studentAssignmentRepository.findByStudentIdAndAssignmentId(200L, 500L))
                .thenReturn(java.util.Optional.empty());

        assertThrows(NotFoundException.class,
                () -> teacherService.getOrCreateScenarioForStudent(500L, 200L));
        verify(speakingAiHelpersService, never()).generateScenario(any(Long.class), anyString(), anyString());
    }

    @Test
    void getOrCreateScenario_throwsNotFound_whenNotSpeakingScenario() {
        Long assignmentId = 500L, studentId = 200L;
        when(studentAssignmentRepository.findByStudentIdAndAssignmentId(studentId, assignmentId))
                .thenReturn(java.util.Optional.of(StudentAssignment.builder().id(1L).build()));
        when(assignmentScenarioRepository.findFirstByAssignmentIdOrderByIdAsc(assignmentId))
                .thenReturn(java.util.Optional.empty());
        when(assignmentRepository.findById(assignmentId)).thenReturn(java.util.Optional.of(
                ClassAssignment.builder().id(assignmentId).assignmentType("GENERAL").build()));

        assertThrows(NotFoundException.class,
                () -> teacherService.getOrCreateScenarioForStudent(assignmentId, studentId));
        verify(speakingAiHelpersService, never()).generateScenario(any(Long.class), anyString(), anyString());
    }

    // ── student detail: cross-class / cross-tenant scoping ─────────────────────

    /**
     * The audit bug: access was gated on "do we share ANY class?" and the student's work was then read
     * by studentId alone. A student enrolled at two centres (common) meant the teacher at centre A could
     * read every submission, score and feedback the teacher at centre B had produced. The query must be
     * scoped to the assignments of the classes actually shared.
     */
    @Test
    void getStudentAssignments_returnsOnlyWorkFromClassesSharedWithThisTeacher() {
        Long teacherId = 1L, studentId = 50L;
        Long myClassId = 10L;

        // Teacher owns class 10; the student is in it (and also, invisibly here, in someone else's class).
        when(classTeacherRepository.findByIdTeacherId(teacherId))
                .thenReturn(List.of(ClassTeacher.builder().id(new ClassTeacherId(myClassId, teacherId)).build()));
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(myClassId, studentId)).thenReturn(true);

        // Only class 10's assignments may be considered.
        when(assignmentRepository.findByClassIdIn(List.of(myClassId)))
                .thenReturn(List.of(ClassAssignment.builder().id(100L).classId(myClassId).topic("Brief").build()));

        StudentAssignment mine = StudentAssignment.builder()
                .id(1L).assignmentId(100L).studentId(studentId).status("GRADED").score(80).build();
        when(studentAssignmentRepository
                .findByStudentIdAndAssignmentIdInAndDeletedFalseOrderByCreatedAtDesc(studentId, List.of(100L)))
                .thenReturn(List.of(mine));

        List<StudentAssignmentDto> result = teacherService.getStudentAssignments(teacherId, studentId);

        assertEquals(1, result.size());
        assertEquals(100L, result.get(0).assignmentId());
        // The unscoped read is gone: no query may fetch this student's work by studentId alone.
        verify(studentAssignmentRepository, never()).findByStudentIdOrderByCreatedAtDesc(any());
    }

    // ── notifications point at the right person ───────────────────────────────

    /**
     * The audit bug: submitting work notified the STUDENT (insertForUser was passed the student's own
     * principal) with copy written for a teacher, and the teacher was told nothing at all. It also put
     * the assignment's topic into the "className" field.
     */
    @Test
    void notifyTeachersOfSubmission_notifiesEveryTeacherOfTheClass_withTheRealClassName() {
        Long classId = 10L, classAssignmentId = 500L, studentId = 50L;

        when(assignmentRepository.findById(classAssignmentId)).thenReturn(java.util.Optional.of(
                ClassAssignment.builder().id(classAssignmentId).classId(classId).topic("Brief schreiben").build()));
        when(classRepository.findById(classId)).thenReturn(java.util.Optional.of(
                TeacherClass.builder().id(classId).name("A1.2 — Thứ 3").build()));
        // Two teachers on the class (primary + co-teacher): both must hear about it.
        when(classTeacherRepository.findByIdClassId(classId)).thenReturn(List.of(
                ClassTeacher.builder().id(new ClassTeacherId(classId, 1L)).build(),
                ClassTeacher.builder().id(new ClassTeacherId(classId, 2L)).build()));

        teacherService.notifyTeachersOfSubmission(classAssignmentId, studentId, "Nguyễn Vũ Hiệp");

        verify(userNotificationService).onTeacherGradingEvent(
                eq(1L), eq(classId), eq("A1.2 — Thứ 3"), eq(classAssignmentId),
                eq(studentId), eq("Nguyễn Vũ Hiệp"), eq("SUBMISSION_RECEIVED"), isNull());
        verify(userNotificationService).onTeacherGradingEvent(
                eq(2L), eq(classId), eq("A1.2 — Thứ 3"), eq(classAssignmentId),
                eq(studentId), eq("Nguyễn Vũ Hiệp"), eq("SUBMISSION_RECEIVED"), isNull());
        // NOT the assignment topic — that is what the old payload put in the className field.
        verify(userNotificationService, never()).onTeacherGradingEvent(
                any(), any(), eq("Brief schreiben"), any(), any(), any(), any(), any());
    }

    @Test
    void getStudentAssignments_rejectsAStudentTheTeacherSharesNoClassWith() {
        Long teacherId = 1L, studentId = 50L;
        when(classTeacherRepository.findByIdTeacherId(teacherId))
                .thenReturn(List.of(ClassTeacher.builder().id(new ClassTeacherId(10L, teacherId)).build()));
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(10L, studentId)).thenReturn(false);

        assertThrows(com.deutschflow.common.exception.ConflictException.class,
                () -> teacherService.getStudentAssignments(teacherId, studentId));
    }
}
