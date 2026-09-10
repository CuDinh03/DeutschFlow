package com.deutschflow.teacher.controller;

import com.deutschflow.common.minor.MinorAiGradingBlockedException;
import com.deutschflow.common.minor.MinorGate;
import com.deutschflow.common.minor.MinorPolicy;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.StudentAssignment;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import com.deutschflow.teacher.service.ClassEnrollmentService;
import com.deutschflow.teacher.service.GradingService;
import com.deutschflow.teacher.service.TeacherService;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Cửa vào THỨ HAI của cùng job chấm AI — bình luận tại chỗ trong {@code TeacherController} đã nói
 * rõ "bỏ sót chỗ này là để nguyên lỗ", nhưng trước ca này {@code TeacherController} KHÔNG có một ca
 * test nào ở bất kỳ mức nào. Nghĩa là dòng gọi cổng ở đó có bị xoá hay đảo chỗ cũng không ai biết.
 *
 * <p>Ca ở đây cố tình hẹp: chỉ canh cổng tuổi D3 trên đúng một endpoint, không mở rộng thành bộ
 * test cho cả controller (việc đó thuộc một đợt khác).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("TeacherController — cổng tuổi trên cửa chấm AI thứ hai (D3)")
class TeacherControllerAiGradeTest {

    private static final long TEACHER_ID = 1L;
    private static final long SUBMISSION_ID = 5L;
    private static final long CLASS_ASSIGNMENT_ID = 9L;
    private static final long OWNING_CLASS_ID = 50L;
    private static final long STUDENT_ID = 3L;

    @Mock TeacherService teacherService;
    @Mock GradingService gradingService;
    @Mock ClassEnrollmentService classEnrollmentService;
    @Mock StudentAssignmentRepository assignmentRepository;
    @Mock ClassAssignmentRepository classAssignmentRepository;
    @Mock ClassStudentRepository classStudentRepository;
    @Mock OrgPoolGuard orgPoolGuard;
    @Mock MinorGate minorGate;

    private TeacherController controller;

    @BeforeEach
    void setUp() {
        controller = new TeacherController(
                teacherService,
                mock(com.deutschflow.teacher.service.FourAxisReportService.class),
                mock(com.deutschflow.gamification.service.XpService.class),
                mock(com.deutschflow.teacher.service.TeacherAnalyticsService.class),
                mock(com.deutschflow.teacher.service.TeacherAdvisoryService.class),
                gradingService, classEnrollmentService, assignmentRepository,
                classAssignmentRepository, classStudentRepository, orgPoolGuard, minorGate);
    }

    private User teacher() {
        User u = mock(User.class);
        when(u.getId()).thenReturn(TEACHER_ID);
        return u;
    }

    /** Bài nộp SUBMITTED của học viên STUDENT_ID, trong lớp mà giáo viên này dạy. */
    private void stubOwnedSubmission() {
        StudentAssignment sa = StudentAssignment.builder()
                .id(SUBMISSION_ID).assignmentId(CLASS_ASSIGNMENT_ID).studentId(STUDENT_ID)
                .status("SUBMITTED").build();
        when(assignmentRepository.findById(SUBMISSION_ID)).thenReturn(Optional.of(sa));
        ClassAssignment ca = ClassAssignment.builder()
                .id(CLASS_ASSIGNMENT_ID).classId(OWNING_CLASS_ID).topic("E-Mail").build();
        when(classAssignmentRepository.findById(CLASS_ASSIGNMENT_ID)).thenReturn(Optional.of(ca));
        when(teacherService.getClassesForTeacher(TEACHER_ID)).thenReturn(List.of(
                new com.deutschflow.teacher.dto.TeacherClassDto(
                        OWNING_CLASS_ID, "Lớp A1", "INVITE1", 0L, 0L, 0L, null)));
    }

    @Test
    @DisplayName("🔴 cổng tuổi chặn ⇒ 403 tới thẳng giáo viên, KHÔNG kích job và KHÔNG tiêu ngân sách")
    void minorGateBlocksBeforeDispatchingTheAsyncJob() {
        stubOwnedSubmission();
        doThrow(new MinorAiGradingBlockedException(
                MinorAiGradingBlockedException.Reason.GUARDIAN_CONSENT_REQUIRED,
                MinorPolicy.Status.MINOR_CENTER_POLICY, "chưa có đồng ý"))
                .when(minorGate).assertAiGradingAllowed(STUDENT_ID);

        assertThatThrownBy(() -> controller.triggerAiGradeForAssignment(teacher(), SUBMISSION_ID))
                .isInstanceOf(MinorAiGradingBlockedException.class);

        verify(gradingService, never()).aiGradeAssignment(anyLong(), anyLong());
        verifyNoInteractions(orgPoolGuard);
    }

    @Test
    @DisplayName("cổng soi CHỦ THỂ là học viên của bài nộp, không phải giáo viên đang đăng nhập")
    void gateIsAskedAboutTheSubmissionOwner() {
        stubOwnedSubmission();

        controller.triggerAiGradeForAssignment(teacher(), SUBMISSION_ID);

        verify(minorGate).assertAiGradingAllowed(STUDENT_ID);
        verify(minorGate, never()).assertAiGradingAllowed(TEACHER_ID);
    }
}
