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
import com.deutschflow.teacher.entity.AssignmentStatus;
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
    @Mock com.deutschflow.common.minor.MinorGate minorGate;

    private static final long SESSION_ID = 7L;
    private static final long LINKED_ASSIGNMENT_ID = 100L; // StudentAssignment PK
    private static final LocalDateTime SUBMITTED_AT = LocalDateTime.of(2026, 1, 1, 8, 0);

    private TeacherAiGradingService service() {
        return new TeacherAiGradingService(
                sessionRepository, messageRepository, openAiChatClient,
                studentAssignmentRepository, aiUsageLedgerService, gradingModelConfig,
                userNotificationService, orgPoolGuard,
                // Cổng tuổi D3: mock mặc định KHÔNG ném ⇒ các ca guard sẵn có giữ nguyên nghĩa.
                minorGate);
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

    /**
     * Parity with the essay path: the speaking auto-grade is a PROPOSAL. It used to write GRADED and
     * notify the student with the raw AI score before any teacher had looked at it.
     */
    @Test
    @DisplayName("autoGradeSession thành công → AI_GRADED (đề xuất), set gradedAt, KHÔNG báo học viên")
    void autoGradeSession_success_setsGradedAt_keepsSubmittedAt_doesNotNotify() {
        stubGradedSession();
        StudentAssignment linked = StudentAssignment.builder()
                .id(LINKED_ASSIGNMENT_ID).assignmentId(9L).studentId(55L)
                .status("SUBMITTED").submittedAt(SUBMITTED_AT).build();
        when(studentAssignmentRepository.findById(LINKED_ASSIGNMENT_ID)).thenReturn(Optional.of(linked));

        service().autoGradeSession(SESSION_ID);

        assertThat(linked.getStatus()).isEqualTo(AssignmentStatus.AI_GRADED);
        assertThat(linked.getScore()).isEqualTo(78);
        assertThat(linked.getGradedAt()).as("gradedAt phải được set").isNotNull();
        // R3 (V323): đường nói liên kết bài tập cũng ghi cột ai_* riêng — không nơi nào được quên.
        assertThat(linked.getAiScore()).isEqualTo(78);
        assertThat(linked.getAiFeedback()).isEqualTo("gut gemacht");
        assertThat(linked.getAiGradedAt()).isNotNull();
        assertThat(linked.getSubmittedAt())
                .as("submittedAt (giờ nộp thật) KHÔNG bị đè bằng giờ chấm").isEqualTo(SUBMITTED_AT);
        verify(studentAssignmentRepository).save(linked);
        verify(userNotificationService, never())
                .onAssignmentGraded(any(), any(), any(), any(), any());
    }

    /**
     * D3 cho khâu CHẤM phiên luyện nói (thêm 11/09/2026 sau vòng soát bảo mật).
     *
     * <p>🪤 Lỗ này KHÔNG nhìn thấy được nếu chỉ đọc đường ghi âm: {@code assertAudioAllowed} chỉ
     * được gọi ở {@code AiSessionController POST /transcribe}, còn {@code /sessions/&#123;id&#125;/chat}
     * nhận thẳng CHỮ do người học gõ. Một học viên vị thành niên gõ hết phiên rồi kết thúc là
     * transcript đi ra nhà cung cấp AI mà không chốt nào chạm tới.
     */
    @Test
    @DisplayName("🔴 phiên GẮN BÀI của học viên bị cổng tuổi chặn ⇒ KHÔNG gọi AI, không ghi điểm")
    void blockedMinorSessionNeverReachesTheAiProvider() {
        AiSpeakingSession session = AiSpeakingSession.builder()
                .id(SESSION_ID).userId(42L).assignmentId(LINKED_ASSIGNMENT_ID).build();
        when(sessionRepository.findById(SESSION_ID)).thenReturn(Optional.of(session));
        when(messageRepository.findBySessionIdOrderByCreatedAtAsc(SESSION_ID))
                .thenReturn(List.of(userMsg("Hallo"), userMsg("Mir geht es gut"), userMsg("Ich lerne Deutsch")));
        org.mockito.Mockito.doThrow(new com.deutschflow.common.minor.MinorAiGradingBlockedException(
                        com.deutschflow.common.minor.MinorAiGradingBlockedException.Reason.GUARDIAN_CONSENT_REQUIRED,
                        com.deutschflow.common.minor.MinorPolicy.Status.MINOR_CENTER_POLICY, "chưa có đồng ý"))
                .when(minorGate).assertAiGradingAllowed(42L);

        service().autoGradeSession(SESSION_ID);

        verify(openAiChatClient, never()).chatCompletion(any(), any(), anyDouble(), any());
        verify(studentAssignmentRepository, never()).save(any());
    }

    @Test
    @DisplayName("phiên TỰ LUYỆN (không gắn bài) KHÔNG bị cổng chạm — đó là chat AI, owner chốt không chặn")
    void freePracticeSessionIsNotGated() {
        AiSpeakingSession session = AiSpeakingSession.builder()
                .id(SESSION_ID).userId(42L).assignmentId(null).build();
        when(sessionRepository.findById(SESSION_ID)).thenReturn(Optional.of(session));
        when(messageRepository.findBySessionIdOrderByCreatedAtAsc(SESSION_ID))
                .thenReturn(List.of(userMsg("Hallo"), userMsg("Mir geht es gut"), userMsg("Ich lerne Deutsch")));
        when(gradingModelConfig.model()).thenReturn("llama-3.3-70b-versatile");
        when(openAiChatClient.chatCompletion(any(), any(), anyDouble(), any()))
                .thenReturn(new AiChatCompletionResult(
                        "{\"score\":78,\"feedback\":\"gut gemacht\"}", null, "groq", "llama-3.3-70b-versatile"));

        service().autoGradeSession(SESSION_ID);

        verify(minorGate, never()).assertAiGradingAllowed(any());
    }
}
