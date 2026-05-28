package com.deutschflow.speaking.service;

import com.deutschflow.speaking.dto.GreetingSessionDto;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.entity.DialogueTemplate;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.speaking.repository.DialogueTemplateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
@DisplayName("GreetingService Unit Tests")
class GreetingServiceTest {

    @Mock
    private AiSpeakingSessionRepository aiSpeakingSessionRepository;

    @Mock
    private DialogueTemplateRepository dialogueTemplateRepository;

    @Mock
    private GroqApiService groqApiService;

    private GreetingService service;

    @BeforeEach
    void setUp() {
        lenient().when(groqApiService.generateDialogueResponse(any(), any(), any(), any()))
                .thenReturn("Hallo! Wie heißt du?");
        lenient().when(groqApiService.evaluateAndFeedback(any(), any(), any(), any()))
                .thenReturn("Sehr gut! Deine Antwort war korrekt.");
        service = new GreetingService(aiSpeakingSessionRepository, dialogueTemplateRepository, groqApiService);
    }

    // -----------------------------------------------------------------------
    // createGreetingSession — validation
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("createGreetingSession — validation")
    class CreateGreetingSessionValidation {

        @Test
        @DisplayName("throws BadRequestException for difficulty = 0 (below min)")
        void difficultyZero_throwsBadRequestException() {
            assertThatThrownBy(() -> service.createGreetingSession(1L, 1L, 0))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Template not found");
        }

        @Test
        @DisplayName("throws BadRequestException for difficulty = 6 (above max)")
        void difficultySix_throwsBadRequestException() {
            assertThatThrownBy(() -> service.createGreetingSession(1L, 1L, 6))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Template not found");
        }

        @Test
        @DisplayName("throws BadRequestException for null difficulty")
        void difficultyNull_throwsBadRequestException() {
            assertThatThrownBy(() -> service.createGreetingSession(1L, 1L, null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Template not found");
        }

        @ParameterizedTest(name = "difficulty = {0} is valid and passes validation")
        @ValueSource(ints = {1, 2, 3, 4, 5})
        @DisplayName("does not throw validation error for valid difficulty 1-5")
        void validDifficultyRange_noValidationError(int difficulty) {
            DialogueTemplate template = buildTemplate(1L, "template_test");
            AiSpeakingSession saved = buildSession(1L, 1L, 1L, difficulty, "IN_PROGRESS");
            when(dialogueTemplateRepository.findById(1L)).thenReturn(Optional.of(template));
            when(aiSpeakingSessionRepository.save(any())).thenReturn(saved);

            GreetingSessionDto result = service.createGreetingSession(1L, 1L, difficulty);
            assertThat(result).isNotNull();
        }

        @Test
        @DisplayName("throws NotFoundException when template does not exist")
        void templateNotFound_throwsNotFoundException() {
            when(dialogueTemplateRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.createGreetingSession(1L, 99L, 2))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Template not found");
        }
    }

    // -----------------------------------------------------------------------
    // createGreetingSession — happy path and session field mapping
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("createGreetingSession — session creation")
    class CreateGreetingSessionHappyPath {

        @Test
        @DisplayName("creates session with correct userId, templateId, and difficultyLevel")
        void validInputs_createsSessionWithCorrectFields() {
            DialogueTemplate template = buildTemplate(1L, "greeting_hello_name");
            AiSpeakingSession saved = buildSession(1L, 1L, 1L, 2, "IN_PROGRESS");
            when(dialogueTemplateRepository.findById(1L)).thenReturn(Optional.of(template));
            when(aiSpeakingSessionRepository.save(any())).thenReturn(saved);

            GreetingSessionDto result = service.createGreetingSession(1L, 1L, 2);

            assertThat(result.userId()).isEqualTo(1L);
            assertThat(result.templateId()).isEqualTo(1L);
            assertThat(result.difficultyLevel()).isEqualTo(2);
            assertThat(result.sessionStatus()).isEqualTo("IN_PROGRESS");
        }

        @Test
        @DisplayName("saves session with sessionMode = GREETING")
        void validInputs_persistsSessionModeAsGreeting() {
            DialogueTemplate template = buildTemplate(1L, "template");
            AiSpeakingSession saved = buildSession(1L, 1L, 1L, 3, "IN_PROGRESS");
            when(dialogueTemplateRepository.findById(1L)).thenReturn(Optional.of(template));
            when(aiSpeakingSessionRepository.save(any())).thenReturn(saved);

            ArgumentCaptor<AiSpeakingSession> captor = ArgumentCaptor.forClass(AiSpeakingSession.class);

            service.createGreetingSession(1L, 1L, 3);

            verify(aiSpeakingSessionRepository).save(captor.capture());
            assertThat(captor.getValue().getSessionMode()).isEqualTo("GREETING");
        }

        @Test
        @DisplayName("saves session with sessionStatus = IN_PROGRESS")
        void validInputs_persistsSessionStatusAsInProgress() {
            DialogueTemplate template = buildTemplate(1L, "template");
            AiSpeakingSession saved = buildSession(1L, 1L, 1L, 3, "IN_PROGRESS");
            when(dialogueTemplateRepository.findById(1L)).thenReturn(Optional.of(template));
            when(aiSpeakingSessionRepository.save(any())).thenReturn(saved);

            ArgumentCaptor<AiSpeakingSession> captor = ArgumentCaptor.forClass(AiSpeakingSession.class);

            service.createGreetingSession(1L, 1L, 3);

            verify(aiSpeakingSessionRepository).save(captor.capture());
            assertThat(captor.getValue().getSessionStatus()).isEqualTo("IN_PROGRESS");
        }

        @Test
        @DisplayName("looks up template by templateId before saving")
        void validInputs_loadsTemplateFromRepository() {
            DialogueTemplate template = buildTemplate(5L, "greeting_template");
            AiSpeakingSession saved = buildSession(1L, 1L, 5L, 1, "IN_PROGRESS");
            when(dialogueTemplateRepository.findById(5L)).thenReturn(Optional.of(template));
            when(aiSpeakingSessionRepository.save(any())).thenReturn(saved);

            service.createGreetingSession(1L, 5L, 1);

            verify(dialogueTemplateRepository).findById(5L);
        }

        @Test
        @DisplayName("saves exactly once to repository")
        void validInputs_savesExactlyOnce() {
            DialogueTemplate template = buildTemplate(1L, "template");
            AiSpeakingSession saved = buildSession(1L, 1L, 1L, 2, "IN_PROGRESS");
            when(dialogueTemplateRepository.findById(1L)).thenReturn(Optional.of(template));
            when(aiSpeakingSessionRepository.save(any())).thenReturn(saved);

            service.createGreetingSession(1L, 1L, 2);

            verify(aiSpeakingSessionRepository, times(1)).save(any());
        }

        @Test
        @DisplayName("returns DTO with session id from saved entity")
        void validInputs_returnsDtoWithSessionId() {
            DialogueTemplate template = buildTemplate(1L, "template");
            AiSpeakingSession saved = buildSession(99L, 1L, 1L, 2, "IN_PROGRESS");
            when(dialogueTemplateRepository.findById(1L)).thenReturn(Optional.of(template));
            when(aiSpeakingSessionRepository.save(any())).thenReturn(saved);

            GreetingSessionDto result = service.createGreetingSession(1L, 1L, 2);

            assertThat(result.id()).isEqualTo(99L);
        }
    }

    // -----------------------------------------------------------------------
    // submitUserResponse — validation
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("submitUserResponse — validation")
    class SubmitUserResponseValidation {

        @Test
        @DisplayName("throws BadRequestException for null user input")
        void nullUserInput_throwsBadRequestException() {
            assertThatThrownBy(() -> service.submitUserResponse(1L, 1L, null, 3))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Session not found");
        }

        @Test
        @DisplayName("throws BadRequestException for blank user input")
        void blankUserInput_throwsBadRequestException() {
            assertThatThrownBy(() -> service.submitUserResponse(1L, 1L, "   ", 3))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Session not found");
        }

        @Test
        @DisplayName("throws BadRequestException for empty string user input")
        void emptyUserInput_throwsBadRequestException() {
            assertThatThrownBy(() -> service.submitUserResponse(1L, 1L, "", 3))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Session not found");
        }

        @Test
        @DisplayName("throws BadRequestException for null confidence")
        void nullConfidence_throwsBadRequestException() {
            assertThatThrownBy(() -> service.submitUserResponse(1L, 1L, "Hallo", null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Session not found");
        }

        @Test
        @DisplayName("throws BadRequestException for confidence = 0 (below min)")
        void confidenceZero_throwsBadRequestException() {
            assertThatThrownBy(() -> service.submitUserResponse(1L, 1L, "Hallo", 0))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Session not found");
        }

        @Test
        @DisplayName("throws BadRequestException for confidence = 6 (above max)")
        void confidenceSix_throwsBadRequestException() {
            assertThatThrownBy(() -> service.submitUserResponse(1L, 1L, "Hallo", 6))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Session not found");
        }

        @ParameterizedTest(name = "confidence = {0} passes validation")
        @ValueSource(ints = {1, 2, 3, 4, 5})
        @DisplayName("does not throw for valid confidence 1-5")
        void validConfidenceRange_noValidationError(int confidence) {
            AiSpeakingSession session = new AiSpeakingSession();
            session.setId(1L);
            session.setUserId(1L);
            when(aiSpeakingSessionRepository.findById(1L)).thenReturn(Optional.of(session));
            when(aiSpeakingSessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            GreetingSessionDto result = service.submitUserResponse(1L, 1L, "Hallo", confidence);
            assertThat(result).isNotNull();
        }

        @Test
        @DisplayName("throws NotFoundException when session not found")
        void sessionNotFound_throwsNotFoundException() {
            when(aiSpeakingSessionRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.submitUserResponse(99L, 1L, "Hallo", 3))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Session not found");
        }

        @Test
        @DisplayName("throws ForbiddenException when user does not own the session")
        void differentUser_throwsForbiddenException() {
            AiSpeakingSession session = new AiSpeakingSession();
            session.setId(1L);
            session.setUserId(2L); // owned by user 2
            when(aiSpeakingSessionRepository.findById(1L)).thenReturn(Optional.of(session));

            assertThatThrownBy(() -> service.submitUserResponse(1L, 1L, "Hallo", 3))
                    .isInstanceOf(SecurityException.class)
                    .hasMessageContaining("Unauthorized access to session");
        }
    }

    // -----------------------------------------------------------------------
    // submitUserResponse — happy path and session updates
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("submitUserResponse — session update")
    class SubmitUserResponseHappyPath {

        @Test
        @DisplayName("updates session with user input and marks status COMPLETED")
        void validInputs_updatesSessionToCompleted() {
            AiSpeakingSession session = new AiSpeakingSession();
            session.setId(1L);
            session.setUserId(1L);
            session.setSessionStatus("IN_PROGRESS");
            when(aiSpeakingSessionRepository.findById(1L)).thenReturn(Optional.of(session));
            when(aiSpeakingSessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            GreetingSessionDto result = service.submitUserResponse(1L, 1L, "Hallo!", 3);

            assertThat(result.userInput()).isEqualTo("Hallo!");
            assertThat(result.sessionStatus()).isEqualTo("COMPLETED");
        }

        @Test
        @DisplayName("stores the confidence score in the session")
        void validInputs_storesConfidenceScore() {
            AiSpeakingSession session = new AiSpeakingSession();
            session.setId(1L);
            session.setUserId(1L);
            when(aiSpeakingSessionRepository.findById(1L)).thenReturn(Optional.of(session));
            when(aiSpeakingSessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            GreetingSessionDto result = service.submitUserResponse(1L, 1L, "Hallo!", 4);

            assertThat(result.userConfidenceScore()).isEqualTo(4);
        }

        @Test
        @DisplayName("generates non-null AI feedback for user input")
        void validInputs_generatesFeedbackFromGroq() {
            AiSpeakingSession session = new AiSpeakingSession();
            session.setId(1L);
            session.setUserId(1L);
            when(aiSpeakingSessionRepository.findById(1L)).thenReturn(Optional.of(session));
            when(aiSpeakingSessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(groqApiService.evaluateAndFeedback(eq("Guten Morgen"), any(), any(), any()))
                    .thenReturn("Sehr gut! Guten Morgen ist richtig.");

            GreetingSessionDto result = service.submitUserResponse(1L, 1L, "Guten Morgen", 3);

            assertThat(result.feedback()).isNotNull();
            assertThat(result.feedback()).isNotBlank();
            verify(groqApiService).evaluateAndFeedback(eq("Guten Morgen"), any(), any(), any());
        }

        @Test
        @DisplayName("saves exactly once to repository")
        void validInputs_savesExactlyOnce() {
            AiSpeakingSession session = new AiSpeakingSession();
            session.setId(1L);
            session.setUserId(1L);
            when(aiSpeakingSessionRepository.findById(1L)).thenReturn(Optional.of(session));
            when(aiSpeakingSessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.submitUserResponse(1L, 1L, "Hallo!", 3);

            verify(aiSpeakingSessionRepository, times(1)).save(any());
        }

        @Test
        @DisplayName("user submitting with minimum valid confidence (1) succeeds")
        void minimumConfidence_succeeds() {
            AiSpeakingSession session = new AiSpeakingSession();
            session.setId(1L);
            session.setUserId(1L);
            when(aiSpeakingSessionRepository.findById(1L)).thenReturn(Optional.of(session));
            when(aiSpeakingSessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            GreetingSessionDto result = service.submitUserResponse(1L, 1L, "Hallo", 1);

            assertThat(result.userConfidenceScore()).isEqualTo(1);
        }

        @Test
        @DisplayName("user submitting with maximum valid confidence (5) succeeds")
        void maximumConfidence_succeeds() {
            AiSpeakingSession session = new AiSpeakingSession();
            session.setId(1L);
            session.setUserId(1L);
            when(aiSpeakingSessionRepository.findById(1L)).thenReturn(Optional.of(session));
            when(aiSpeakingSessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            GreetingSessionDto result = service.submitUserResponse(1L, 1L, "Ausgezeichnet!", 5);

            assertThat(result.userConfidenceScore()).isEqualTo(5);
        }
    }

    // -----------------------------------------------------------------------
    // getGreetingSession
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("getGreetingSession")
    class GetGreetingSession {

        @Test
        @DisplayName("throws NotFoundException when session does not exist")
        void sessionNotFound_throwsNotFoundException() {
            when(aiSpeakingSessionRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getGreetingSession(99L, 1L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Session not found");
        }

        @Test
        @DisplayName("throws ForbiddenException when userId does not match session owner")
        void differentUser_throwsForbiddenException() {
            AiSpeakingSession session = new AiSpeakingSession();
            session.setId(1L);
            session.setUserId(2L); // owned by user 2
            when(aiSpeakingSessionRepository.findById(1L)).thenReturn(Optional.of(session));

            assertThatThrownBy(() -> service.getGreetingSession(1L, 1L))
                    .isInstanceOf(SecurityException.class)
                    .hasMessageContaining("Unauthorized access to session");
        }

        @Test
        @DisplayName("returns DTO with all fields correctly mapped for authorized user")
        void authorizedUser_returnsFullyMappedDto() {
            LocalDateTime now = LocalDateTime.now();
            AiSpeakingSession session = new AiSpeakingSession();
            session.setId(10L);
            session.setUserId(1L);
            session.setTemplateId(5L);
            session.setDifficultyLevel(3);
            session.setAiPrompt("Wie heißen Sie?");
            session.setAiResponse("Ich heiße Anna.");
            session.setUserInput("Mein Name ist Max.");
            session.setFeedback("Sehr gut!");
            session.setUserConfidenceScore(4);
            session.setSessionStatus("COMPLETED");
            session.setCreatedAt(now);
            when(aiSpeakingSessionRepository.findById(10L)).thenReturn(Optional.of(session));

            GreetingSessionDto result = service.getGreetingSession(10L, 1L);

            assertThat(result.id()).isEqualTo(10L);
            assertThat(result.userId()).isEqualTo(1L);
            assertThat(result.templateId()).isEqualTo(5L);
            assertThat(result.difficultyLevel()).isEqualTo(3);
            assertThat(result.aiPrompt()).isEqualTo("Wie heißen Sie?");
            assertThat(result.aiResponse()).isEqualTo("Ich heiße Anna.");
            assertThat(result.userInput()).isEqualTo("Mein Name ist Max.");
            assertThat(result.feedback()).isEqualTo("Sehr gut!");
            assertThat(result.userConfidenceScore()).isEqualTo(4);
            assertThat(result.sessionStatus()).isEqualTo("COMPLETED");
            assertThat(result.createdAt()).isEqualTo(now);
        }

        @Test
        @DisplayName("does not call save when only reading a session")
        void getSession_neverSavesToRepository() {
            AiSpeakingSession session = new AiSpeakingSession();
            session.setId(1L);
            session.setUserId(1L);
            session.setCreatedAt(LocalDateTime.now());
            when(aiSpeakingSessionRepository.findById(1L)).thenReturn(Optional.of(session));

            service.getGreetingSession(1L, 1L);

            verify(aiSpeakingSessionRepository, never()).save(any());
        }

        @Test
        @DisplayName("maps null optional fields (aiPrompt, aiResponse, userInput) without error")
        void nullOptionalFields_mapsSafely() {
            AiSpeakingSession session = new AiSpeakingSession();
            session.setId(1L);
            session.setUserId(1L);
            session.setTemplateId(1L);
            session.setDifficultyLevel(1);
            session.setSessionStatus("IN_PROGRESS");
            session.setCreatedAt(LocalDateTime.now());
            // aiPrompt, aiResponse, userInput, feedback, userConfidenceScore intentionally null
            when(aiSpeakingSessionRepository.findById(1L)).thenReturn(Optional.of(session));

            GreetingSessionDto result = service.getGreetingSession(1L, 1L);

            assertThat(result.aiPrompt()).isNull();
            assertThat(result.aiResponse()).isNull();
            assertThat(result.userInput()).isNull();
            assertThat(result.feedback()).isNull();
            assertThat(result.userConfidenceScore()).isNull();
        }
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private DialogueTemplate buildTemplate(Long id, String name) {
        return DialogueTemplate.builder()
                .id(id)
                .templateName(name)
                .difficultyLevel(1)
                .build();
    }

    private AiSpeakingSession buildSession(Long id, Long userId, Long templateId,
                                            Integer difficulty, String status) {
        AiSpeakingSession session = new AiSpeakingSession();
        session.setId(id);
        session.setUserId(userId);
        session.setTemplateId(templateId);
        session.setDifficultyLevel(difficulty);
        session.setSessionMode("GREETING");
        session.setSessionStatus(status);
        session.setCreatedAt(LocalDateTime.now());
        return session;
    }
}
