package com.deutschflow.teacher.service;

import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.entity.AiSpeakingMessage;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.repository.AiSpeakingMessageRepository;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.teacher.entity.StudentAssignment;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * D2 regression: Sprechen {@code autoGradeSession} khi cập nhật StudentAssignment liên kết PHẢI:
 * (1) không đè bài GV đã EVALUATED/GRADED; (2) set gradedAt (KHÔNG đè submittedAt); (3) báo học viên.
 */
@ExtendWith(MockitoExtension.class)
class TeacherAiGradingServiceGuardTest {

    @Mock AiSpeakingSessionRepository sessionRepository;
    @Mock AiSpeakingMessageRepository messageRepository;
    @Mock OpenAiChatClient openAiChatClient;
    @Mock StudentAssignmentRepository studentAssignmentRepository;
    @Mock AiUsageLedgerService aiUsageLedgerService;
    @Mock GradingModelConfig gradingModelConfig;
    @Mock UserNotificationService userNotificationService;
    @Mock OrgPoolGuard orgPoolGuard;
    @Mock StudentCompetencyService studentCompetencyService;

    private static final long SESSION_ID = 7L;
    private static final long LINKED_ASSIGNMENT_ID = 100L; // StudentAssignment PK
    private static final LocalDateTime SUBMITTED_AT = LocalDateTime.of(2026, 1, 1, 8, 0);

    private TeacherAiGradingService service() {
        return new TeacherAiGradingService(
                sessionRepository, messageRepository, openAiChatClient,
                studentAssignmentRepository, aiUsageLedgerService, gradingModelConfig,
                userNotificationService, orgPoolGuard, studentCompetencyService);
    }

    private AiSpeakingMessage userMsg(String text) {
        return AiSpeakingMessage.builder()
                .role(AiSpeakingMessage.MessageRole.USER)
                .userText(text)
                .build();
    }

    private void stubGradedSession() {
        AiSpeakingSession session = AiSpeakingSession.builder()
                .id(SESSION_ID).userId(42L).assignmentId(LINKED_ASSIGNMENT_ID).build();
        when(sessionRepository.findById(SESSION_ID)).thenReturn(Optional.of(session));
        when(messageRepository.findBySessionIdOrderByCreatedAtAsc(SESSION_ID))
                .thenReturn(List.of(userMsg("Hallo"), userMsg("Mir geht es gut"), userMsg("Ich lerne Deutsch")));
        when(gradingModelConfig.model()).thenReturn("llama-3.3-70b-versatile");
        when(openAiChatClient.chatCompletion(any(), any(), anyDouble(), any()))
                .thenReturn(new AiChatCompletionResult(
                        "{\"score\":78,\"feedback\":\"gut gemacht\"}", null, "groq", "llama-3.3-70b-versatile"));
    }

    @Test
    @DisplayName("autoGradeSession KHÔNG đè assignment đã EVALUATED (giữ điểm GV)")
    void autoGradeSession_doesNotClobberEvaluatedAssignment() {
        stubGradedSession();
        StudentAssignment linked = StudentAssignment.builder()
                .id(LINKED_ASSIGNMENT_ID).assignmentId(9L).studentId(55L)
                .status("EVALUATED").score(95).feedback("GV: xuất sắc").submittedAt(SUBMITTED_AT).build();
        when(studentAssignmentRepository.findById(LINKED_ASSIGNMENT_ID)).thenReturn(Optional.of(linked));

        service().autoGradeSession(SESSION_ID);

        assertThat(linked.getScore()).isEqualTo(95);
        assertThat(linked.getStatus()).isEqualTo("EVALUATED");
        verify(studentAssignmentRepository, never()).save(any());
        verify(userNotificationService, never())
                .onAssignmentGraded(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("autoGradeSession thành công → GRADED, set gradedAt (KHÔNG đè submittedAt), báo học viên")
    void autoGradeSession_success_setsGradedAt_keepsSubmittedAt_notifies() {
        stubGradedSession();
        StudentAssignment linked = StudentAssignment.builder()
                .id(LINKED_ASSIGNMENT_ID).assignmentId(9L).studentId(55L)
                .status("SUBMITTED").submittedAt(SUBMITTED_AT).build();
        when(studentAssignmentRepository.findById(LINKED_ASSIGNMENT_ID)).thenReturn(Optional.of(linked));

        service().autoGradeSession(SESSION_ID);

        assertThat(linked.getStatus()).isEqualTo("GRADED");
        assertThat(linked.getScore()).isEqualTo(78);
        assertThat(linked.getGradedAt()).as("gradedAt phải được set").isNotNull();
        assertThat(linked.getSubmittedAt())
                .as("submittedAt (giờ nộp thật) KHÔNG bị đè bằng giờ chấm").isEqualTo(SUBMITTED_AT);
        verify(studentAssignmentRepository).save(linked);
        verify(userNotificationService)
                .onAssignmentGraded(eq(55L), eq("ASSIGNMENT"), eq(9L), eq(78), any());
    }
}
