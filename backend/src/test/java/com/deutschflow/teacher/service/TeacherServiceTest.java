package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.speaking.service.SpeakingAiHelpersService;
import com.deutschflow.teacher.dto.ClassAssignmentDto;
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
