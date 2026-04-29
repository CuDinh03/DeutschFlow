package com.deutschflow.speaking;

import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.dto.AiSpeakingChatResponse;
import com.deutschflow.speaking.dto.AiSpeakingMessageDto;
import com.deutschflow.speaking.dto.AiSpeakingSessionDto;
import com.deutschflow.speaking.entity.AiSpeakingSession.SessionStatus;
import com.deutschflow.speaking.repository.AiSpeakingMessageRepository;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.speaking.service.AiSpeakingService;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Integration test for the AI Speaking Practice feature.
 *
 * <p>Uses H2 in-memory database (via application-test.yml) and mocks the OpenAI client
 * to avoid real API calls.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AiSpeakingIntegrationTest {

    private static final String VALID_AI_RESPONSE = """
            {
              "ai_speech_de": "Das ist interessant! Wie lange machst du das schon?",
              "correction": null,
              "explanation_vi": null,
              "grammar_point": null,
              "learning_status": {
                "new_word": null,
                "user_interest_detected": null
              }
            }
            """;

    private static final String AI_RESPONSE_WITH_CORRECTION = """
            {
              "ai_speech_de": "Ach so, du warst in der Schule! War es interessant?",
              "correction": "Ich bin gestern in die Schule gegangen.",
              "explanation_vi": "Dùng 'sein' thay vì 'haben' với động từ chỉ sự di chuyển.",
              "grammar_point": "Perfekt mit sein/haben",
              "learning_status": {
                "new_word": "Unterricht",
                "user_interest_detected": "Lernalltag"
              }
            }
            """;

    @Autowired
    private AiSpeakingService aiSpeakingService;

    @Autowired
    private AiSpeakingSessionRepository sessionRepository;

    @Autowired
    private AiSpeakingMessageRepository messageRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserLearningProfileRepository profileRepository;

    @MockBean
    private OpenAiChatClient openAiChatClient;

    private User userA;
    private User userB;

    @BeforeEach
    void setUp() {
        // Create two test users
        userA = userRepository.save(User.builder()
                .email("user-a-speaking@test.com")
                .passwordHash("$2a$10$hash")
                .displayName("User A")
                .role(User.Role.STUDENT)
                .build());

        userB = userRepository.save(User.builder()
                .email("user-b-speaking@test.com")
                .passwordHash("$2a$10$hash")
                .displayName("User B")
                .role(User.Role.STUDENT)
                .build());

        when(openAiChatClient.chatCompletion(any(), anyString(), anyDouble()))
                .thenReturn(VALID_AI_RESPONSE);
    }

    // =========================================================================
    // Session lifecycle tests
    // =========================================================================

    @Test
    void createSession_shouldPersistSessionWithActiveStatus() {
        AiSpeakingSessionDto session = aiSpeakingService.createSession(userA.getId(), "Mein Alltag");

        assertThat(session.id()).isNotNull();
        assertThat(session.status()).isEqualTo("ACTIVE");
        assertThat(session.topic()).isEqualTo("Mein Alltag");
        assertThat(session.messageCount()).isEqualTo(0);
        assertThat(session.startedAt()).isNotNull();
    }

    @Test
    void createSession_withNullTopic_shouldSucceed() {
        AiSpeakingSessionDto session = aiSpeakingService.createSession(userA.getId(), null);

        assertThat(session.id()).isNotNull();
        assertThat(session.topic()).isNull();
    }

    @Test
    void endSession_shouldTransitionToEndedStatus() {
        AiSpeakingSessionDto session = aiSpeakingService.createSession(userA.getId(), null);

        AiSpeakingSessionDto ended = aiSpeakingService.endSession(userA.getId(), session.id());

        assertThat(ended.status()).isEqualTo("ENDED");
        assertThat(ended.endedAt()).isNotNull();
    }

    // =========================================================================
    // Chat flow tests
    // =========================================================================

    @Test
    void chat_shouldPersistTwoMessagesAndReturnResponse() {
        AiSpeakingSessionDto session = aiSpeakingService.createSession(userA.getId(), null);
        long initialCount = messageRepository.count();

        AiSpeakingChatResponse response = aiSpeakingService.chat(
                userA.getId(), session.id(), "Ich lerne Deutsch.");

        assertThat(response.aiSpeechDe()).isNotBlank();
        assertThat(response.sessionId()).isEqualTo(session.id());
        assertThat(response.messageId()).isNotNull();

        // Exactly 2 messages persisted
        assertThat(messageRepository.count()).isEqualTo(initialCount + 2);
    }

    @Test
    void chat_shouldIncrementMessageCountByTwo() {
        AiSpeakingSessionDto session = aiSpeakingService.createSession(userA.getId(), null);

        aiSpeakingService.chat(userA.getId(), session.id(), "Hallo!");

        var updatedSession = sessionRepository.findById(session.id()).orElseThrow();
        assertThat(updatedSession.getMessageCount()).isEqualTo(2);
    }

    @Test
    void chat_withCorrectionResponse_shouldReturnCorrectionFields() {
        when(openAiChatClient.chatCompletion(any(), anyString(), anyDouble()))
                .thenReturn(AI_RESPONSE_WITH_CORRECTION);

        AiSpeakingSessionDto session = aiSpeakingService.createSession(userA.getId(), null);
        AiSpeakingChatResponse response = aiSpeakingService.chat(
                userA.getId(), session.id(), "Ich habe gestern gehen in die Schule.");

        assertThat(response.correction()).isEqualTo("Ich bin gestern in die Schule gegangen.");
        assertThat(response.explanationVi()).contains("sein");
        assertThat(response.grammarPoint()).isEqualTo("Perfekt mit sein/haben");
        assertThat(response.learningStatus().newWord()).isEqualTo("Unterricht");
        assertThat(response.learningStatus().userInterestDetected()).isEqualTo("Lernalltag");
    }

    @Test
    void chat_withNoErrors_shouldReturnNullCorrectionFields() {
        AiSpeakingSessionDto session = aiSpeakingService.createSession(userA.getId(), null);
        AiSpeakingChatResponse response = aiSpeakingService.chat(
                userA.getId(), session.id(), "Ich lerne Deutsch.");

        assertThat(response.correction()).isNull();
        assertThat(response.explanationVi()).isNull();
        assertThat(response.grammarPoint()).isNull();
    }

    // =========================================================================
    // Message history tests
    // =========================================================================

    @Test
    void getMessages_shouldReturnMessagesInChronologicalOrder() {
        AiSpeakingSessionDto session = aiSpeakingService.createSession(userA.getId(), null);
        aiSpeakingService.chat(userA.getId(), session.id(), "Erste Nachricht");
        aiSpeakingService.chat(userA.getId(), session.id(), "Zweite Nachricht");

        List<AiSpeakingMessageDto> messages = aiSpeakingService.getMessages(userA.getId(), session.id());

        assertThat(messages).hasSize(4); // 2 USER + 2 ASSISTANT
        // First message should be USER
        assertThat(messages.get(0).role()).isEqualTo("USER");
        assertThat(messages.get(0).userText()).isEqualTo("Erste Nachricht");
    }

    // =========================================================================
    // Session list tests
    // =========================================================================

    @Test
    void getSessions_shouldReturnOnlyUserOwnSessions() {
        aiSpeakingService.createSession(userA.getId(), "Session A1");
        aiSpeakingService.createSession(userA.getId(), "Session A2");
        aiSpeakingService.createSession(userB.getId(), "Session B1");

        Page<AiSpeakingSessionDto> sessionsA = aiSpeakingService.getSessions(
                userA.getId(), PageRequest.of(0, 10));

        assertThat(sessionsA.getContent()).hasSize(2);
        assertThat(sessionsA.getContent())
                .allMatch(s -> s.topic().startsWith("Session A"));
    }

    // =========================================================================
    // Security / authorization tests
    // =========================================================================

    @Test
    void chat_withWrongUser_shouldThrowNotFoundException() {
        AiSpeakingSessionDto session = aiSpeakingService.createSession(userA.getId(), null);

        assertThatThrownBy(() ->
                aiSpeakingService.chat(userB.getId(), session.id(), "Hallo!"))
                .hasMessageContaining("Session not found");
    }

    @Test
    void getMessages_withWrongUser_shouldThrowNotFoundException() {
        AiSpeakingSessionDto session = aiSpeakingService.createSession(userA.getId(), null);

        assertThatThrownBy(() ->
                aiSpeakingService.getMessages(userB.getId(), session.id()))
                .hasMessageContaining("Session not found");
    }

    @Test
    void endSession_withWrongUser_shouldThrowNotFoundException() {
        AiSpeakingSessionDto session = aiSpeakingService.createSession(userA.getId(), null);

        assertThatThrownBy(() ->
                aiSpeakingService.endSession(userB.getId(), session.id()))
                .hasMessageContaining("Session not found");
    }

    // =========================================================================
    // Session state machine tests
    // =========================================================================

    @Test
    void chat_onEndedSession_shouldThrowConflictException() {
        AiSpeakingSessionDto session = aiSpeakingService.createSession(userA.getId(), null);
        aiSpeakingService.endSession(userA.getId(), session.id());

        assertThatThrownBy(() ->
                aiSpeakingService.chat(userA.getId(), session.id(), "Hallo!"))
                .hasMessageContaining("already ended");
    }

    @Test
    void endSession_onAlreadyEndedSession_shouldThrowConflictException() {
        AiSpeakingSessionDto session = aiSpeakingService.createSession(userA.getId(), null);
        aiSpeakingService.endSession(userA.getId(), session.id());

        assertThatThrownBy(() ->
                aiSpeakingService.endSession(userA.getId(), session.id()))
                .hasMessageContaining("already ended");
    }
}
