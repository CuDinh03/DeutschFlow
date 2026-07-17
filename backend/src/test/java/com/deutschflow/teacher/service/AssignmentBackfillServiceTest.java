package com.deutschflow.teacher.service;

import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.StudentAssignment;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssignmentBackfillServiceTest {

    private static final Long CLASS_ID = 10L;
    private static final Long STUDENT_ID = 42L;

    @Mock private ClassAssignmentRepository assignmentRepository;
    @Mock private StudentAssignmentRepository studentAssignmentRepository;
    @InjectMocks private AssignmentBackfillService service;

    @Test
    @DisplayName("creates a PENDING row only for assignments the student is missing")
    void createsOnlyMissing() {
        when(assignmentRepository.findByClassIdOrderByCreatedAtDesc(CLASS_ID))
                .thenReturn(List.of(ca(1L), ca(2L), ca(3L)));
        // The student already has a row for assignment 2 only.
        when(studentAssignmentRepository
                .findByStudentIdAndAssignmentIdInAndDeletedFalseOrderByCreatedAtDesc(eq(STUDENT_ID), anyList()))
                .thenReturn(List.of(row(2L)));

        int created = service.ensureAssignmentsForStudent(CLASS_ID, STUDENT_ID);

        assertThat(created).isEqualTo(2);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<StudentAssignment>> cap = ArgumentCaptor.forClass(List.class);
        verify(studentAssignmentRepository).saveAll(cap.capture());
        assertThat(cap.getValue())
                .extracting(StudentAssignment::getAssignmentId)
                .containsExactlyInAnyOrder(1L, 3L);
        assertThat(cap.getValue())
                .allMatch(sa -> sa.getStudentId().equals(STUDENT_ID) && "PENDING".equals(sa.getStatus()));
    }

    @Test
    @DisplayName("no-op when the student already has every row")
    void idempotentWhenComplete() {
        when(assignmentRepository.findByClassIdOrderByCreatedAtDesc(CLASS_ID))
                .thenReturn(List.of(ca(1L), ca(2L)));
        when(studentAssignmentRepository
                .findByStudentIdAndAssignmentIdInAndDeletedFalseOrderByCreatedAtDesc(eq(STUDENT_ID), anyList()))
                .thenReturn(List.of(row(1L), row(2L)));

        int created = service.ensureAssignmentsForStudent(CLASS_ID, STUDENT_ID);

        assertThat(created).isZero();
        verify(studentAssignmentRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("no-op for a class with no assignments")
    void emptyClass() {
        when(assignmentRepository.findByClassIdOrderByCreatedAtDesc(CLASS_ID)).thenReturn(List.of());

        int created = service.ensureAssignmentsForStudent(CLASS_ID, STUDENT_ID);

        assertThat(created).isZero();
        verify(studentAssignmentRepository, never()).saveAll(any());
    }

    private static ClassAssignment ca(Long id) {
        return ClassAssignment.builder()
                .id(id).classId(CLASS_ID).topic("A" + id).assignmentType("GENERAL")
                .createdAt(LocalDateTime.now()).build();
    }

    private static StudentAssignment row(Long assignmentId) {
        return StudentAssignment.builder()
                .id(assignmentId * 100).assignmentId(assignmentId)
                .studentId(STUDENT_ID).status("PENDING").build();
    }
}
