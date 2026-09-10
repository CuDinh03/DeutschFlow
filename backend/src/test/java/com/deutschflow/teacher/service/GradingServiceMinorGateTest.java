package com.deutschflow.teacher.service;

import com.deutschflow.common.minor.MinorAiGradingBlockedException;
import com.deutschflow.common.minor.MinorGate;
import com.deutschflow.common.minor.MinorPolicy;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.teacher.entity.AssignmentStatus;
import com.deutschflow.teacher.entity.StudentAssignment;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * D3 — LƯỚI THỨ HAI của cổng tuổi, nằm trong chính job {@code @Async}.
 *
 * <p>Vì sao lưới này cần ca riêng: hai controller đã kiểm đồng bộ, nên nếu chỉ có ca ở tầng
 * controller thì một cửa vào THỨ BA thêm sau này (job nền, endpoint admin, retry hàng loạt) sẽ đẩy
 * thẳng bài của trẻ ra nhà cung cấp AI mà không ca nào đỏ. Ca ở đây khẳng định hai điều mà tầng
 * controller không nói được:
 * <ol>
 *   <li>bị chặn ⇒ TUYỆT ĐỐI không gọi {@code OpenAiChatClient} — dữ liệu không rời hệ thống;</li>
 *   <li>bị chặn ⇒ bài rơi về {@code GRADING_FAILED} để hiện lại trong hàng đợi chấm tay, chứ không
 *       ném ra ngoài (ném trong {@code @Async} chỉ vào log, không tới ai) và cũng không kẹt mãi ở
 *       {@code SUBMITTED} như thể chưa ai đụng tới.</li>
 * </ol>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("GradingService — cổng tuổi trong job chấm AI (D3)")
class GradingServiceMinorGateTest {

    private static final long SUBMISSION_ID = 5L;
    private static final long STUDENT_ID = 3L;
    private static final long TEACHER_ID = 1L;

    @Mock StudentAssignmentRepository studentAssignmentRepository;
    @Mock ClassAssignmentRepository classAssignmentRepository;
    @Mock ClassStudentRepository classStudentRepository;
    @Mock ClassTeacherRepository classTeacherRepository;
    @Mock TeacherClassRepository teacherClassRepository;
    @Mock UserRepository userRepository;
    @Mock UserNotificationService userNotificationService;
    @Mock OpenAiChatClient openAiChatClient;
    @Mock AiUsageLedgerService aiUsageLedgerService;
    @Mock GradingModelConfig gradingModelConfig;
    @Mock com.deutschflow.ai.tier.LlmTierResolver llmTierResolver;
    @Mock com.deutschflow.material.service.MaterialService materialService;
    @Mock MinorGate minorGate;

    private GradingService gradingService() {
        return new GradingService(
                studentAssignmentRepository, classAssignmentRepository, classStudentRepository,
                classTeacherRepository, teacherClassRepository, userRepository,
                userNotificationService, openAiChatClient, aiUsageLedgerService, gradingModelConfig,
                llmTierResolver, materialService,
                new SubmissionFileUrlResolver(mock(S3StorageService.class)),
                minorGate);
    }

    private StudentAssignment submitted() {
        return StudentAssignment.builder()
                .id(SUBMISSION_ID).assignmentId(9L).studentId(STUDENT_ID)
                .status(AssignmentStatus.SUBMITTED)
                .submissionContent("Ich habe gestern einen Brief geschrieben.")
                .build();
    }

    @Test
    @DisplayName("🔴 học viên bị cổng tuổi chặn ⇒ KHÔNG gọi AI lần nào")
    void blockedStudentNeverReachesTheAiProvider() {
        StudentAssignment sa = submitted();
        when(studentAssignmentRepository.findById(SUBMISSION_ID)).thenReturn(Optional.of(sa));
        doThrow(new MinorAiGradingBlockedException(
                MinorAiGradingBlockedException.Reason.GUARDIAN_CONSENT_REQUIRED,
                MinorPolicy.Status.MINOR_CENTER_POLICY, "chưa có đồng ý"))
                .when(minorGate).assertAiGradingAllowed(STUDENT_ID);

        gradingService().aiGradeAssignment(SUBMISSION_ID, TEACHER_ID);

        verifyNoInteractions(openAiChatClient);
    }

    @Test
    @DisplayName("bị chặn ⇒ bài về GRADING_FAILED để hiện lại trong hàng đợi chấm tay")
    void blockedSubmissionFallsBackToManualQueue() {
        StudentAssignment sa = submitted();
        when(studentAssignmentRepository.findById(SUBMISSION_ID)).thenReturn(Optional.of(sa));
        doThrow(new MinorAiGradingBlockedException(
                MinorAiGradingBlockedException.Reason.BIRTH_DATE_REQUIRED,
                MinorPolicy.Status.UNKNOWN, "chưa có ngày sinh"))
                .when(minorGate).assertAiGradingAllowed(STUDENT_ID);

        gradingService().aiGradeAssignment(SUBMISSION_ID, TEACHER_ID);

        assertThat(sa.getStatus()).isEqualTo(AssignmentStatus.GRADING_FAILED);
    }

    @Test
    @DisplayName("🔴 cổng soi CHỦ THỂ là học viên, không phải giáo viên đang chấm")
    void gateIsAskedAboutTheStudentNotTheTeacher() {
        StudentAssignment sa = submitted();
        when(studentAssignmentRepository.findById(SUBMISSION_ID)).thenReturn(Optional.of(sa));
        doThrow(new MinorAiGradingBlockedException(
                MinorAiGradingBlockedException.Reason.GUARDIAN_CONSENT_REVOKED,
                MinorPolicy.Status.MINOR_LEGAL, "đã thu hồi"))
                .when(minorGate).assertAiGradingAllowed(STUDENT_ID);

        gradingService().aiGradeAssignment(SUBMISSION_ID, TEACHER_ID);

        verify(minorGate).assertAiGradingAllowed(STUDENT_ID);
        verify(minorGate, never()).assertAiGradingAllowed(TEACHER_ID);
    }

    @Test
    @DisplayName("không bị chặn ⇒ job chạy tiếp và gọi AI như cũ")
    void allowedStudentStillGetsGraded() {
        StudentAssignment sa = submitted();
        when(studentAssignmentRepository.findById(SUBMISSION_ID)).thenReturn(Optional.of(sa));
        when(classAssignmentRepository.findById(9L)).thenReturn(Optional.empty());
        when(materialService.assignmentMaterialTitles(9L)).thenReturn(java.util.List.of());
        when(llmTierResolver.spec(any())).thenReturn(new com.deutschflow.ai.tier.TierSpec(
                com.deutschflow.ai.tier.LlmTier.GRADING_EXAM, "openai/gpt-oss-120b",
                null, null, null, null, null, null, "low", false, false));
        when(openAiChatClient.chatCompletionForTier(any(), any(), anyDouble(), any()))
                .thenReturn(null);

        gradingService().aiGradeAssignment(SUBMISSION_ID, TEACHER_ID);

        verify(openAiChatClient).chatCompletionForTier(any(), any(), anyDouble(), any());
    }

    /**
     * Lưới thứ hai chỉ `catch` đúng {@link MinorAiGradingBlockedException}. Nếu cổng ném loại KHÁC
     * (DB chết lúc đọc ngày sinh, hay `IllegalArgumentException` vì studentId null) thì an toàn hiện
     * đang dựa vào một `catch (Exception)` bao ngoài TOÀN BỘ method — thứ mà một lần thu hẹp
     * `catch` sau này có thể vô tình bỏ đi. Ca này khoá lại bất biến "lỗi loại nào cũng KHÔNG được
     * đi tiếp tới nhà cung cấp AI", để lần refactor đó đỏ ngay thay vì mở lại fail-open lặng lẽ.
     */
    @Test
    @DisplayName("🔴 cổng ném lỗi KHÁC (DB chết) ⇒ vẫn KHÔNG gọi AI, không fail-open")
    void gateThrowingSomethingElseIsStillNotFailOpen() {
        StudentAssignment sa = submitted();
        when(studentAssignmentRepository.findById(SUBMISSION_ID)).thenReturn(Optional.of(sa));
        doThrow(new org.springframework.dao.QueryTimeoutException("DB không phản hồi"))
                .when(minorGate).assertAiGradingAllowed(STUDENT_ID);

        gradingService().aiGradeAssignment(SUBMISSION_ID, TEACHER_ID);

        verifyNoInteractions(openAiChatClient);
        assertThat(sa.getStatus()).isEqualTo(AssignmentStatus.GRADING_FAILED);
    }
}
