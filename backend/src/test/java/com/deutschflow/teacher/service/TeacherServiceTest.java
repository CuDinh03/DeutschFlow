package com.deutschflow.teacher.service;

import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.speaking.service.SpeakingAiHelpersService;
import com.deutschflow.teacher.dto.ClassAssignmentDto;
import com.deutschflow.teacher.dto.CreateAssignmentRequest;
import com.deutschflow.teacher.dto.StudentAssignmentDto;
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
import static org.mockito.ArgumentMatchers.any;
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
}
