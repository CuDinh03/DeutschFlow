package com.deutschflow.teacher.controller;

import com.deutschflow.common.quota.FreeTierGuard;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.StudentAssignment;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import com.deutschflow.teacher.service.GradingService;
import com.deutschflow.teacher.service.HandwritingOcrService;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * D3 regression: {@code triggerAiGrade} phải phân quyền theo LỚP SỞ HỮU bài tập, không theo
 * "học viên nằm trong lớp nào đó của tôi" — chặn GV chấm bài trong bài tập của lớp mình không dạy (IDOR).
 */
@ExtendWith(MockitoExtension.class)
class GradingControllerAuthzTest {

    @Mock GradingService gradingService;
    @Mock StudentAssignmentRepository studentAssignmentRepository;
    @Mock ClassAssignmentRepository classAssignmentRepository;
    @Mock ClassTeacherRepository classTeacherRepository;
    @Mock HandwritingOcrService handwritingOcrService;
    @Mock OrgPoolGuard orgPoolGuard;
    @Mock FreeTierGuard freeTierGuard;

    private static final long TEACHER_ID = 1L;
    private static final long SUBMISSION_ID = 5L;
    private static final long CLASS_ASSIGNMENT_ID = 9L;
    private static final long OWNING_CLASS_ID = 50L;

    private GradingController controller() {
        return new GradingController(
                gradingService, studentAssignmentRepository, classAssignmentRepository,
                classTeacherRepository, handwritingOcrService, orgPoolGuard, freeTierGuard);
    }

    private User teacher() {
        User u = mock(User.class);
        when(u.getId()).thenReturn(TEACHER_ID);
        return u;
    }

    private void stubSubmission(String status) {
        StudentAssignment sa = StudentAssignment.builder()
                .id(SUBMISSION_ID).assignmentId(CLASS_ASSIGNMENT_ID).studentId(3L).status(status).build();
        when(studentAssignmentRepository.findById(SUBMISSION_ID)).thenReturn(Optional.of(sa));
        ClassAssignment ca = ClassAssignment.builder()
                .id(CLASS_ASSIGNMENT_ID).classId(OWNING_CLASS_ID).topic("E-Mail").build();
        when(classAssignmentRepository.findById(CLASS_ASSIGNMENT_ID)).thenReturn(Optional.of(ca));
    }

    @Test
    @DisplayName("403 + không chấm khi GV KHÔNG dạy lớp sở hữu bài tập (IDOR bị chặn)")
    void triggerAiGrade_deniedWhenTeacherDoesNotOwnAssignmentClass() {
        stubSubmission("SUBMITTED");
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(OWNING_CLASS_ID, TEACHER_ID))
                .thenReturn(false);

        ResponseEntity<Map<String, String>> res = controller().triggerAiGrade(teacher(), SUBMISSION_ID);

        assertThat(res.getStatusCode().value()).isEqualTo(403);
        verify(gradingService, never()).aiGradeAssignment(anyLong(), anyLong());
    }

    @Test
    @DisplayName("200 + chấm khi GV dạy đúng lớp sở hữu bài tập, bài đang SUBMITTED")
    void triggerAiGrade_allowedWhenTeacherOwnsAssignmentClass() {
        stubSubmission("SUBMITTED");
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(OWNING_CLASS_ID, TEACHER_ID))
                .thenReturn(true);

        ResponseEntity<Map<String, String>> res = controller().triggerAiGrade(teacher(), SUBMISSION_ID);

        assertThat(res.getStatusCode().value()).isEqualTo(200);
        verify(orgPoolGuard).assertOrgPoolAvailable(TEACHER_ID, 2_000L);
        verify(gradingService).aiGradeAssignment(SUBMISSION_ID, TEACHER_ID);
    }

    @Test
    @DisplayName("409 + không chấm khi bài đã EVALUATED (không chấm lại đè điểm GV)")
    void triggerAiGrade_conflictWhenAlreadyEvaluated() {
        stubSubmission("EVALUATED");
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(OWNING_CLASS_ID, TEACHER_ID))
                .thenReturn(true);

        ResponseEntity<Map<String, String>> res = controller().triggerAiGrade(teacher(), SUBMISSION_ID);

        assertThat(res.getStatusCode().value()).isEqualTo(409);
        verify(gradingService, never()).aiGradeAssignment(anyLong(), anyLong());
    }
}
