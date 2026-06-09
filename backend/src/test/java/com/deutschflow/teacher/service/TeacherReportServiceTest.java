package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.dto.GradebookDto;
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

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
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
}
