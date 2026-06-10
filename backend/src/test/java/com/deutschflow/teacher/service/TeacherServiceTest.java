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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
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

    private TeacherService teacherService;

    @BeforeEach
    void setUp() {
        teacherService = new TeacherService(
                classRepository,
                classStudentRepository,
                classTeacherRepository,
                assignmentRepository,
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
                s3StorageService
        );
    }

    @Test
    void createAssignment_Success() {
        Long teacherId = 1L;
        Long classId = 100L;
        CreateAssignmentRequest req = new CreateAssignmentRequest("Test Topic", "Test Desc", "GENERAL", 10L, LocalDateTime.now().plusDays(7), null);

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
    void getStudentAssignments_Success() {
        Long teacherId = 1L;
        Long studentId = 200L;

        ClassTeacher ct = ClassTeacher.builder().id(new ClassTeacherId(100L, teacherId)).build();
        when(classTeacherRepository.findByIdTeacherId(teacherId)).thenReturn(List.of(ct));
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(100L, studentId)).thenReturn(true);

        StudentAssignment sa = StudentAssignment.builder()
                .id(1L).assignmentId(500L).studentId(studentId).status("SUBMITTED").score(90).feedback("Good")
                .build();

        when(studentAssignmentRepository.findByStudentIdOrderByCreatedAtDesc(studentId)).thenReturn(List.of(sa));

        List<StudentAssignmentDto> result = teacherService.getStudentAssignments(teacherId, studentId);

        assertEquals(1, result.size());
        assertEquals(90, result.get(0).teacherScore());
        assertEquals("SUBMITTED", result.get(0).status());
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
        when(userRepository.findByEmail("s@y.de")).thenReturn(java.util.Optional.of(
                com.deutschflow.user.entity.User.builder().id(5L)
                        .role(com.deutschflow.user.entity.User.Role.STUDENT).build()));

        assertThrows(com.deutschflow.common.exception.BadRequestException.class,
                () -> teacherService.addCoTeacher(1L, 100L, "s@y.de"));
        verify(classTeacherRepository, never()).save(any());
    }

    @Test
    void addCoTeacher_savesAssistant_whenValid() {
        when(classTeacherRepository.findById(new ClassTeacherId(100L, 1L))).thenReturn(java.util.Optional.of(
                ClassTeacher.builder().id(new ClassTeacherId(100L, 1L)).role("PRIMARY").build()));
        when(userRepository.findByEmail("t@y.de")).thenReturn(java.util.Optional.of(
                com.deutschflow.user.entity.User.builder().id(7L)
                        .role(com.deutschflow.user.entity.User.Role.TEACHER).build()));
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(100L, 7L)).thenReturn(false);

        teacherService.addCoTeacher(1L, 100L, "t@y.de");

        ArgumentCaptor<ClassTeacher> captor = ArgumentCaptor.forClass(ClassTeacher.class);
        verify(classTeacherRepository).save(captor.capture());
        assertEquals("ASSISTANT", captor.getValue().getRole());
        assertEquals(7L, captor.getValue().getId().getTeacherId());
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
        verify(speakingAiHelpersService, never()).generateScenario(anyString(), anyString());
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
        when(speakingAiHelpersService.generateScenario("Nói về gia đình", "A2")).thenReturn(
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
        verify(speakingAiHelpersService, never()).generateScenario(anyString(), anyString());
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
        verify(speakingAiHelpersService, never()).generateScenario(anyString(), anyString());
    }
}
