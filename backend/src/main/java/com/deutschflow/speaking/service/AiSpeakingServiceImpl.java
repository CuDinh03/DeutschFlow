package com.deutschflow.speaking.service;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.speaking.ai.*;
import com.deutschflow.speaking.dto.*;
import com.deutschflow.speaking.entity.AiSpeakingMessage;
import com.deutschflow.speaking.entity.AiSpeakingMessage.MessageRole;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.entity.AiSpeakingSession.SessionStatus;
import com.deutschflow.speaking.entity.UserGrammarError;
import com.deutschflow.speaking.repository.AiSpeakingMessageRepository;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.speaking.repository.UserGrammarErrorRepository;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.LocalDateTime;
import java.util.*;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class AiSpeakingServiceImpl implements AiSpeakingService {

    private final AiSpeakingSessionRepository sessionRepository;
    private final AiSpeakingMessageRepository messageRepository;
    private final UserLearningProfileRepository profileRepository;
    private final UserGrammarErrorRepository grammarErrorRepository;
    private final OpenAiChatClient openAiChatClient;
    private final SystemPromptBuilder promptBuilder;
    private final AiResponseParser responseParser;
    private final ObjectMapper objectMapper;

    @Override
    public AiSpeakingSessionDto createSession(Long userId, String topic, String cefrLevel) {
        AiSpeakingSession session = AiSpeakingSession.builder()
                .userId(userId)
                .topic(topic)
                .cefrLevel(cefrLevel)
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
        UserLearningProfile profile = profileRepository.findByUserId(userId).orElse(null);
        List<String> knownInterests = extractInterests(profile);

        // 3. Load top weak grammar points to inject into prompt
        List<WeakPoint> weakPoints = grammarErrorRepository.findTopWeakPoints(
                userId, PageRequest.of(0, 5));

        // 4. Build conversation history (last 10 messages, chronological order)
        List<AiSpeakingMessage> recentMessages =
                messageRepository.findTop10BySessionIdOrderByCreatedAtDesc(sessionId);
        Collections.reverse(recentMessages);

        // 5. Build system prompt with profile + topic + level (session level overrides profile)
        UserLearningProfile effectiveProfile = profile != null ? profile : defaultProfile();
        String systemPrompt = promptBuilder.buildSystemPrompt(
                effectiveProfile, knownInterests, session.getTopic(), weakPoints, session.getCefrLevel());

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

        // 6. Call AI (AiServiceException propagates as-is → mapped to 503 by controller)
        String rawJson = openAiChatClient.chatCompletion(openAiMessages, null, 0.7);
        AiResponseDto parsed = responseParser.parse(rawJson);

        // 7. Persist USER message
        AiSpeakingMessage userMsg = AiSpeakingMessage.builder()
                .sessionId(sessionId)
                .role(MessageRole.USER)
                .userText(userMessage)
                .build();
        messageRepository.save(userMsg);

        // 8. Persist ASSISTANT message
        AiSpeakingMessage assistantMsg = AiSpeakingMessage.builder()
                .sessionId(sessionId)
                .role(MessageRole.ASSISTANT)
                .aiSpeechDe(parsed.aiSpeechDe())
                .correction(parsed.correction())
                .explanationVi(parsed.explanationVi())
                .grammarPoint(parsed.grammarPoint())
                .newWord(parsed.newWord())
                .userInterestDetected(parsed.userInterestDetected())
                .build();
        assistantMsg = messageRepository.save(assistantMsg);

        // 9. Save grammar error record if AI detected one
        if (parsed.correction() != null && parsed.grammarPoint() != null) {
            saveGrammarError(userId, sessionId, assistantMsg.getId(),
                    parsed.grammarPoint(), userMessage, parsed.correction(), effectiveProfile);
        }

        // 10. Merge newly detected interest into UserLearningProfile
        if (parsed.userInterestDetected() != null && !parsed.userInterestDetected().isBlank()
                && profile != null) {
            mergeInterest(profile, parsed.userInterestDetected());
        }

        // 11. Update session metadata
        session.setLastActivityAt(LocalDateTime.now());
        session.setMessageCount(session.getMessageCount() + 2);
        sessionRepository.save(session);

        // 12. Return structured response
        return new AiSpeakingChatResponse(
                assistantMsg.getId(),
                sessionId,
                parsed.aiSpeechDe(),
                parsed.correction(),
                parsed.explanationVi(),
                parsed.grammarPoint(),
                new AiSpeakingChatResponse.LearningStatus(
                        parsed.newWord(),
                        parsed.userInterestDetected()
                )
        );
    }

    @Override
    public void chatStream(Long userId, Long sessionId, String userMessage, SseEmitter emitter) {
        try {
            AiSpeakingSession session = loadSessionForUser(userId, sessionId);
            if (session.getStatus() == SessionStatus.ENDED) {
                emitter.send(SseEmitter.event().name("error").data("Session has already ended."));
                emitter.complete();
                return;
            }

            UserLearningProfile profile = profileRepository.findByUserId(userId).orElse(null);
            List<String> knownInterests = extractInterests(profile);
            List<WeakPoint> weakPoints = grammarErrorRepository.findTopWeakPoints(
                    userId, PageRequest.of(0, 5));

            List<AiSpeakingMessage> recentMessages =
                    messageRepository.findTop10BySessionIdOrderByCreatedAtDesc(sessionId);
            Collections.reverse(recentMessages);

            UserLearningProfile effectiveProfile = profile != null ? profile : defaultProfile();
            String systemPrompt = promptBuilder.buildSystemPrompt(
                    effectiveProfile, knownInterests, session.getTopic(), weakPoints, session.getCefrLevel());

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

            StringBuilder fullResponse = new StringBuilder();

            openAiChatClient.chatCompletionStream(openAiMessages, null, 0.7,
                    token -> {
                        fullResponse.append(token);
                        try {
                            emitter.send(SseEmitter.event().name("token").data(token));
                        } catch (Exception e) {
                            log.warn("[SSE] Failed to send token: {}", e.getMessage());
                        }
                    },
                    () -> {
                        // Streaming done — parse full JSON, persist, then send done event
                        try {
                            AiResponseDto parsed = responseParser.parse(fullResponse.toString());

                            AiSpeakingMessage userMsg = AiSpeakingMessage.builder()
                                    .sessionId(sessionId).role(MessageRole.USER)
                                    .userText(userMessage).build();
                            messageRepository.save(userMsg);

                            AiSpeakingMessage assistantMsg = AiSpeakingMessage.builder()
                                    .sessionId(sessionId).role(MessageRole.ASSISTANT)
                                    .aiSpeechDe(parsed.aiSpeechDe())
                                    .correction(parsed.correction())
                                    .explanationVi(parsed.explanationVi())
                                    .grammarPoint(parsed.grammarPoint())
                                    .newWord(parsed.newWord())
                                    .userInterestDetected(parsed.userInterestDetected())
                                    .build();
                            assistantMsg = messageRepository.save(assistantMsg);

                            if (parsed.correction() != null && parsed.grammarPoint() != null) {
                                saveGrammarError(userId, sessionId, assistantMsg.getId(),
                                        parsed.grammarPoint(), userMessage, parsed.correction(),
                                        effectiveProfile);
                            }

                            if (parsed.userInterestDetected() != null
                                    && !parsed.userInterestDetected().isBlank()
                                    && profile != null) {
                                mergeInterest(profile, parsed.userInterestDetected());
                            }

                            session.setLastActivityAt(LocalDateTime.now());
                            session.setMessageCount(session.getMessageCount() + 2);
                            sessionRepository.save(session);

                            AiSpeakingChatResponse donePayload = new AiSpeakingChatResponse(
                                    assistantMsg.getId(), sessionId,
                                    parsed.aiSpeechDe(), parsed.correction(),
                                    parsed.explanationVi(), parsed.grammarPoint(),
                                    new AiSpeakingChatResponse.LearningStatus(
                                            parsed.newWord(), parsed.userInterestDetected()));
                            emitter.send(SseEmitter.event().name("done")
                                    .data(objectMapper.writeValueAsString(donePayload)));
                            emitter.complete();
                        } catch (Exception ex) {
                            log.error("[SSE] Error in onComplete handler", ex);
                            emitter.completeWithError(ex);
                        }
                    });
        } catch (Exception ex) {
            log.error("[SSE] Stream setup error", ex);
            emitter.completeWithError(ex);
        }
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

    private void mergeInterest(UserLearningProfile profile, String newInterest) {
        try {
            Set<String> updated = new LinkedHashSet<>(extractInterests(profile));
            updated.add(newInterest.trim());
            profile.setInterestsJson(objectMapper.writeValueAsString(updated));
            profileRepository.save(profile);
        } catch (Exception e) {
            log.warn("Failed to merge interest '{}': {}", newInterest, e.getMessage());
        }
    }

    private void saveGrammarError(Long userId, Long sessionId, Long messageId,
                                   String grammarPoint, String originalText,
                                   String correctionText, UserLearningProfile profile) {
        try {
            String cefrLevel = (profile != null && profile.getTargetLevel() != null)
                    ? profile.getTargetLevel().name() : null;
            grammarErrorRepository.save(UserGrammarError.builder()
                    .userId(userId)
                    .sessionId(sessionId)
                    .messageId(messageId)
                    .grammarPoint(grammarPoint)
                    .originalText(originalText)
                    .correctionText(correctionText)
                    .severity(detectSeverity(correctionText))
                    .cefrLevel(cefrLevel)
                    .createdAt(LocalDateTime.now())
                    .build());
        } catch (Exception e) {
            log.warn("Failed to save grammar error: {}", e.getMessage());
        }
    }

    private String detectSeverity(String correction) {
        if (correction == null || correction.isBlank()) return "low";
        String lower = correction.toLowerCase();
        if (lower.contains("falsch") || lower.contains("incorrect") || lower.contains("never")) {
            return "high";
        }
        return "medium";
    }

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
                s.getId(), s.getTopic(), s.getCefrLevel(), s.getStatus().name(),
                s.getStartedAt(), s.getLastActivityAt(), s.getEndedAt(), s.getMessageCount());
    }

    private AiSpeakingMessageDto toMessageDto(AiSpeakingMessage m) {
        return new AiSpeakingMessageDto(
                m.getId(), m.getRole().name(), m.getUserText(),
                m.getAiSpeechDe(), m.getCorrection(), m.getExplanationVi(),
                m.getGrammarPoint(), m.getNewWord(), m.getUserInterestDetected(), m.getCreatedAt());
    }
}
