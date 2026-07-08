package com.deutschflow.teacher.service;

import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.OpenAiChatClient;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * D1 regression: {@code aiGradeAssignment} PHẢI có status-guard — AI chấm không được ghi đè điểm GV
 * đã chốt (EVALUATED) hay chấm lại bài đã GRADED (tránh mất điểm GV + báo/tốn token trùng).
 */
@ExtendWith(MockitoExtension.class)
class GradingServiceGuardTest {

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

    private GradingService gradingService() {
        return new GradingService(
                studentAssignmentRepository, classAssignmentRepository, classStudentRepository,
                classTeacherRepository, teacherClassRepository, userRepository,
                userNotificationService, openAiChatClient, aiUsageLedgerService, gradingModelConfig);
    }

    @Test
    @DisplayName("aiGradeAssignment KHÔNG đè bài đã EVALUATED (giữ nguyên điểm + nhận xét GV)")
    void aiGradeAssignment_skipsEvaluated_keepsTeacherGrade() {
        StudentAssignment sa = StudentAssignment.builder()
                .id(5L).assignmentId(9L).studentId(3L).status("EVALUATED")
                .score(90).feedback("GV: rất tốt").build();
        when(studentAssignmentRepository.findById(5L)).thenReturn(Optional.of(sa));

        gradingService().aiGradeAssignment(5L, 1L);

        verifyNoInteractions(openAiChatClient); // no billable call
        verify(studentAssignmentRepository, never()).save(any());
        verify(userNotificationService, never())
                .onAssignmentGraded(any(), any(), any(), any(), any());
        assertThat(sa.getScore()).isEqualTo(90);
        assertThat(sa.getStatus()).isEqualTo("EVALUATED");
    }

    @Test
    @DisplayName("aiGradeAssignment KHÔNG chấm lại bài đã GRADED (không báo/tốn token trùng)")
    void aiGradeAssignment_skipsAlreadyGraded() {
        StudentAssignment sa = StudentAssignment.builder()
                .id(6L).assignmentId(9L).studentId(3L).status("GRADED").score(70).build();
        when(studentAssignmentRepository.findById(6L)).thenReturn(Optional.of(sa));

        gradingService().aiGradeAssignment(6L, 1L);

        verifyNoInteractions(openAiChatClient);
        verify(studentAssignmentRepository, never()).save(any());
        verify(userNotificationService, never())
                .onAssignmentGraded(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("aiGradeAssignment VẪN chấm bài SUBMITTED → GRADED + notify (happy path còn nguyên)")
    void aiGradeAssignment_gradesSubmitted() {
        StudentAssignment sa = StudentAssignment.builder()
                .id(7L).assignmentId(9L).studentId(3L).status("SUBMITTED")
                .submissionContent("Hallo, ich lerne Deutsch in Berlin.").build();
        when(studentAssignmentRepository.findById(7L)).thenReturn(Optional.of(sa));
        when(classAssignmentRepository.findById(9L)).thenReturn(Optional.empty());
        when(gradingModelConfig.model()).thenReturn("llama-3.3-70b-versatile");
        when(openAiChatClient.chatCompletion(any(), any(), anyDouble(), any()))
                .thenReturn(new AiChatCompletionResult(
                        "{\"score\":82,\"feedback\":\"gut\"}", null, "groq", "llama-3.3-70b-versatile"));

        gradingService().aiGradeAssignment(7L, 1L);

        assertThat(sa.getStatus()).isEqualTo("GRADED");
        assertThat(sa.getScore()).isEqualTo(82);
        verify(studentAssignmentRepository).save(sa);
        verify(userNotificationService)
                .onAssignmentGraded(eq(3L), eq("ASSIGNMENT"), eq(9L), eq(82), any());
    }

    @Test
    @DisplayName("D8: chấm lỗi ghi feedback CHUNG cho HV, không lộ nguyên nhân raw")
    void aiGradeAssignment_failure_writesGenericFeedback() {
        StudentAssignment sa = StudentAssignment.builder()
                .id(11L).assignmentId(9L).studentId(3L).status("SUBMITTED")
                .submissionContent("   ").build(); // blank → fail before any AI call
        when(studentAssignmentRepository.findById(11L)).thenReturn(Optional.of(sa));

        gradingService().aiGradeAssignment(11L, 1L);

        assertThat(sa.getStatus()).isEqualTo("GRADING_FAILED");
        assertThat(sa.getFeedback()).isEqualTo("Chưa chấm tự động được, giáo viên sẽ chấm lại.");
        assertThat(sa.getFeedback()).doesNotContain("[AI").doesNotContain("Exception");
        verifyNoInteractions(openAiChatClient);
    }

    @Test
    @DisplayName("aiGradeAssignment chấm lại bài GRADING_FAILED (cho retry) → GRADED")
    void aiGradeAssignment_retriesFailed() {
        StudentAssignment sa = StudentAssignment.builder()
                .id(8L).assignmentId(9L).studentId(3L).status("GRADING_FAILED")
                .submissionContent("Ein kurzer deutscher Text zum Bewerten.").build();
        when(studentAssignmentRepository.findById(8L)).thenReturn(Optional.of(sa));
        when(classAssignmentRepository.findById(9L)).thenReturn(Optional.empty());
        when(gradingModelConfig.model()).thenReturn("llama-3.3-70b-versatile");
        when(openAiChatClient.chatCompletion(any(), any(), anyDouble(), any()))
                .thenReturn(new AiChatCompletionResult(
                        "{\"score\":60,\"feedback\":\"ok\"}", null, "groq", "llama-3.3-70b-versatile"));

        gradingService().aiGradeAssignment(8L, 1L);

        assertThat(sa.getStatus()).isEqualTo("GRADED");
        assertThat(sa.getScore()).isEqualTo(60);
        verify(studentAssignmentRepository).save(sa);
    }
}
