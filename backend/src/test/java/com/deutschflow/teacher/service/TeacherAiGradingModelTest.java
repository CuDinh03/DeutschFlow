package com.deutschflow.teacher.service;

import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.TokenUsage;
import com.deutschflow.speaking.entity.AiSpeakingMessage;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.repository.AiSpeakingMessageRepository;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Khoá regression: chấm Sprechen (nói) PHẢI dùng model CHẤM, KHÔNG truyền null (null = model nói).
 * Đảm bảo MỌI luồng chấm tách hẳn model nói, không chỉ Schreiben.
 */
@ExtendWith(MockitoExtension.class)
class TeacherAiGradingModelTest {

    @Mock AiSpeakingSessionRepository sessionRepository;
    @Mock AiSpeakingMessageRepository messageRepository;
    @Mock OpenAiChatClient openAiChatClient;
    @Mock StudentAssignmentRepository studentAssignmentRepository;
    @Mock AiUsageLedgerService aiUsageLedgerService;
    @Mock GradingModelConfig gradingModelConfig;
    @Mock UserNotificationService userNotificationService;
    @Mock OrgPoolGuard orgPoolGuard;

    private AiSpeakingMessage userMsg(String text) {
        return AiSpeakingMessage.builder()
                .role(AiSpeakingMessage.MessageRole.USER)
                .userText(text)
                .build();
    }

    @Test
    @DisplayName("autoGradeSession chấm Sprechen bằng MODEL CHẤM (không null)")
    void autoGradeSession_usesGradingModel() {
        long sessionId = 7L;
        AiSpeakingSession session = AiSpeakingSession.builder()
                .id(sessionId)
                .userId(42L)
                .build(); // assignmentId null → bỏ qua nhánh cập nhật StudentAssignment

        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(messageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId))
                .thenReturn(List.of(userMsg("Hallo"), userMsg("Mir geht es gut"), userMsg("Ich lerne Deutsch")));
        when(gradingModelConfig.model()).thenReturn("llama-3.3-70b-versatile");
        when(openAiChatClient.chatCompletion(any(), eq("llama-3.3-70b-versatile"), anyDouble(), any()))
                .thenReturn(new AiChatCompletionResult(
                        "{\"score\":78,\"feedback\":\"gut\"}", TokenUsage.exact(10, 20, 30), "groq", "llama-3.3-70b-versatile"));

        new TeacherAiGradingService(
                sessionRepository, messageRepository, openAiChatClient,
                studentAssignmentRepository, aiUsageLedgerService, gradingModelConfig,
                userNotificationService, orgPoolGuard)
                .autoGradeSession(sessionId);

        ArgumentCaptor<String> model = ArgumentCaptor.forClass(String.class);
        verify(openAiChatClient).chatCompletion(any(), model.capture(), anyDouble(), any());
        assertThat(model.getValue())
                .as("Sprechen grading must use the grading model, never null (speaking default)")
                .isEqualTo("llama-3.3-70b-versatile");
    }
}
