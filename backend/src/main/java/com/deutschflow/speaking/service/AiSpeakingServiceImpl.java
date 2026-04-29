package com.deutschflow.speaking.service;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.speaking.ai.*;
import com.deutschflow.speaking.dto.*;
import com.deutschflow.speaking.entity.AiSpeakingMessage;
import com.deutschflow.speaking.entity.AiSpeakingMessage.MessageRole;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.entity.AiSpeakingSession.SessionStatus;
import com.deutschflow.speaking.repository.AiSpeakingMessageRepository;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class AiSpeakingServiceImpl implements AiSpeakingService {

    private final AiSpeakingSessionRepository sessionRepository;
    private final AiSpeakingMessageRepository messageRepository;
    private final UserLearningProfileRepository profileRepository;
    private final OpenAiChatClient openAiChatClient;
    private final SystemPromptBuilder promptBuilder;
    private final AiResponseParser responseParser;
    private final ObjectMapper objectMapper;

    @Override
    public AiSpeakingSessionDto createSession(Long userId, String topic) {
        AiSpeakingSession session = AiSpeakingSession.builder()
                .userId(userId)
                .topic(topic)
                .status(SessionStatus.ACTIVE)
                .messageCount(0)
                .build();
        session = sessionRepository.save(session);
        return toSessionDto(session);
    }

    @Override
    public AiSpeakingChatResponse chat(Long userId, Long sessionId, String userMessage) {
        // 1. Validate session ownership and status
        AiSpeakingSession session = loadSessionForUser(userId, sessionId);
        if (session.getStatus() == SessionStatus.ENDED) {
            throw new ConflictException("This session has already ended.");
        }

        // 2. Load user profile for personalization
        UserLearningProfile profile = profileRepository.findByUserId(userId)
                .orElse(null);
        List<String> knownInterests = extractInterests(profile);

        // 3. Build conversation history (last 10 messages, chronological order)
        List<AiSpeakingMessage> recentMessages =
                messageRepository.findTop10BySessionIdOrderByCreatedAtDesc(sessionId);
        Collections.reverse(recentMessages);

        // 4. Build OpenAI messages array
        String systemPrompt = profile != null
                ? promptBuilder.buildSystemPrompt(profile, knownInterests)
                : promptBuilder.buildSystemPrompt(defaultProfile(), knownInterests);

        List<ChatMessage> openAiMessages = new ArrayList<>();
        openAiMessages.add(new ChatMessage("system", systemPrompt));

        for (AiSpeakingMessage msg : recentMessages) {
            if (msg.getRole() == MessageRole.USER) {
                openAiMessages.add(new ChatMessage("user", msg.getUserText()));
            } else {
                openAiMessages.add(new ChatMessage("assistant", msg.getAiSpeechDe()));
            }
        }
        openAiMessages.add(new ChatMessage("user", userMessage));

        // 5. Call AI (AiServiceException propagates as-is → mapped to 503 by controller)
        String rawJson = openAiChatClient.chatCompletion(openAiMessages, null, 0.7);
        AiResponseDto aiResponse = responseParser.parse(rawJson);

        // 6. Persist USER message
        AiSpeakingMessage userMsg = AiSpeakingMessage.builder()
                .sessionId(sessionId)
                .role(MessageRole.USER)
                .userText(userMessage)
                .build();
        messageRepository.save(userMsg);

        // 7. Persist ASSISTANT message
        AiSpeakingMessage assistantMsg = AiSpeakingMessage.builder()
                .sessionId(sessionId)
                .role(MessageRole.ASSISTANT)
                .aiSpeechDe(aiResponse.aiSpeechDe())
                .correction(aiResponse.correction())
                .explanationVi(aiResponse.explanationVi())
                .grammarPoint(aiResponse.grammarPoint())
                .newWord(aiResponse.newWord())
                .userInterestDetected(aiResponse.userInterestDetected())
                .build();
        assistantMsg = messageRepository.save(assistantMsg);

        // 8. Update session metadata
        session.setLastActivityAt(LocalDateTime.now());
        session.setMessageCount(session.getMessageCount() + 2);
        sessionRepository.save(session);

        // 9. Return structured response
        return new AiSpeakingChatResponse(
                assistantMsg.getId(),
                sessionId,
                aiResponse.aiSpeechDe(),
                aiResponse.correction(),
                aiResponse.explanationVi(),
                aiResponse.grammarPoint(),
                new AiSpeakingChatResponse.LearningStatus(
                        aiResponse.newWord(),
                        aiResponse.userInterestDetected()
                )
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<AiSpeakingMessageDto> getMessages(Long userId, Long sessionId) {
        loadSessionForUser(userId, sessionId); // validates ownership
        return messageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId)
                .stream()
                .map(this::toMessageDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AiSpeakingSessionDto> getSessions(Long userId, Pageable pageable) {
        return sessionRepository.findByUserId(userId, pageable)
                .map(this::toSessionDto);
    }

    @Override
    public AiSpeakingSessionDto endSession(Long userId, Long sessionId) {
        AiSpeakingSession session = loadSessionForUser(userId, sessionId);
        if (session.getStatus() == SessionStatus.ENDED) {
            throw new ConflictException("This session has already ended.");
        }
        session.setStatus(SessionStatus.ENDED);
        session.setEndedAt(LocalDateTime.now());
        session = sessionRepository.save(session);
        return toSessionDto(session);
    }

    // --- Private helpers ---

    private AiSpeakingSession loadSessionForUser(Long userId, Long sessionId) {
        AiSpeakingSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new NotFoundException("Session not found: " + sessionId));
        if (!session.getUserId().equals(userId)) {
            // Return 404 to avoid leaking session existence to other users
            throw new NotFoundException("Session not found: " + sessionId);
        }
        return session;
    }

    private List<String> extractInterests(UserLearningProfile profile) {
        if (profile == null || profile.getInterestsJson() == null || profile.getInterestsJson().isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(profile.getInterestsJson(), new TypeReference<List<String>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse interestsJson for user profile: {}", e.getMessage());
            return List.of();
        }
    }

    /**
     * Creates a minimal default profile when the user has no learning profile yet.
     */
    private UserLearningProfile defaultProfile() {
        return UserLearningProfile.builder()
                .targetLevel(UserLearningProfile.TargetLevel.B1)
                .goalType(UserLearningProfile.GoalType.CERT)
                .currentLevel(UserLearningProfile.CurrentLevel.A0)
                .sessionsPerWeek(3)
                .minutesPerSession(30)
                .build();
    }

    private AiSpeakingSessionDto toSessionDto(AiSpeakingSession s) {
        return new AiSpeakingSessionDto(
                s.getId(),
                s.getTopic(),
                s.getStatus().name(),
                s.getStartedAt(),
                s.getLastActivityAt(),
                s.getEndedAt(),
                s.getMessageCount()
        );
    }

    private AiSpeakingMessageDto toMessageDto(AiSpeakingMessage m) {
        return new AiSpeakingMessageDto(
                m.getId(),
                m.getRole().name(),
                m.getUserText(),
                m.getAiSpeechDe(),
                m.getCorrection(),
                m.getExplanationVi(),
                m.getGrammarPoint(),
                m.getNewWord(),
                m.getUserInterestDetected(),
                m.getCreatedAt()
        );
    }
}
