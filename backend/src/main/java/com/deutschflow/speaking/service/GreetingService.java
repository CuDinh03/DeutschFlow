package com.deutschflow.speaking.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.dto.GreetingSessionDto;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.entity.DialogueTemplate;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.speaking.repository.DialogueTemplateRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class GreetingService {

    private static final int MIN_SCALE = 1;
    private static final int MAX_SCALE = 5;

    private final AiSpeakingSessionRepository aiSpeakingSessionRepository;
    private final DialogueTemplateRepository dialogueTemplateRepository;
    private final GroqApiService groqApiService;
    private final AiUsageLedgerService ledgerService;

    public GreetingService(
            AiSpeakingSessionRepository aiSpeakingSessionRepository,
            DialogueTemplateRepository dialogueTemplateRepository,
            GroqApiService groqApiService,
            AiUsageLedgerService ledgerService) {
        this.aiSpeakingSessionRepository = aiSpeakingSessionRepository;
        this.dialogueTemplateRepository = dialogueTemplateRepository;
        this.groqApiService = groqApiService;
        this.ledgerService = ledgerService;
    }

    @Transactional
    public GreetingSessionDto createGreetingSession(Long userId, Long templateId, Integer difficultyLevel) {
        // Validated here as well as on the request DTO: the DTO's @Valid only guards the HTTP entry
        // point, and an out-of-range difficulty silently changes the CEFR level used for the prompt.
        requireDifficulty(difficultyLevel);
        DialogueTemplate template = dialogueTemplateRepository.findById(templateId)
                .orElseThrow(() -> new NotFoundException("Template not found: " + templateId));

        String cefrLevel = difficultyLevel <= 2 ? "A1" : "A2";
        AiChatCompletionResult dialogueResult = groqApiService.generateDialogueResponse(
                template.getUserPromptTemplate(), null, template.getTemplateName(), cefrLevel);
        if (dialogueResult.usage() != null) {
            ledgerService.record(userId, dialogueResult.provider(), dialogueResult.model(),
                    dialogueResult.usage(), "GREETING_DIALOGUE", null, null);
        }
        String aiResponse = dialogueResult.content();

        AiSpeakingSession session = new AiSpeakingSession();
        session.setUserId(userId);
        session.setTemplateId(templateId);
        session.setDifficultyLevel(difficultyLevel);
        session.setSessionMode("GREETING");
        session.setSessionStatus("IN_PROGRESS");
        session.setAiPrompt(template.getUserPromptTemplate());
        session.setAiResponse(aiResponse);
        session.setCreatedAt(LocalDateTime.now());
        session.setUpdatedAt(LocalDateTime.now());

        AiSpeakingSession saved = aiSpeakingSessionRepository.save(session);
        return toDto(saved);
    }

    @Transactional
    public GreetingSessionDto submitUserResponse(Long sessionId, Long userId, String userInput, Integer confidence) {
        if (userInput == null || userInput.isBlank()) {
            throw new BadRequestException("userInput must not be blank");
        }
        requireConfidence(confidence);
        AiSpeakingSession session = aiSpeakingSessionRepository.findById(sessionId)
                .orElseThrow(() -> new NotFoundException("Session not found: " + sessionId));

        if (!session.getUserId().equals(userId)) {
            throw new ForbiddenException("Unauthorized access to session");
        }

        AiChatCompletionResult evalResult = groqApiService.evaluateAndFeedback(
                userInput, session.getAiResponse() != null ? session.getAiResponse() : "",
                "A1", session.getTemplateId() != null ? session.getTemplateId().toString() : "greeting");
        if (evalResult.usage() != null) {
            ledgerService.record(userId, evalResult.provider(), evalResult.model(),
                    evalResult.usage(), "GREETING_EVAL", null, null);
        }
        String feedback = evalResult.content();

        session.setUserInput(userInput);
        session.setUserConfidenceScore(confidence);
        session.setFeedback(feedback);
        session.setSessionStatus("COMPLETED");
        session.setUpdatedAt(LocalDateTime.now());

        AiSpeakingSession updated = aiSpeakingSessionRepository.save(session);
        return toDto(updated);
    }

    public GreetingSessionDto getGreetingSession(Long sessionId, Long userId) {
        AiSpeakingSession session = aiSpeakingSessionRepository.findById(sessionId)
                .orElseThrow(() -> new NotFoundException("Session not found: " + sessionId));

        if (!session.getUserId().equals(userId)) {
            throw new ForbiddenException("Unauthorized access to session");
        }

        return toDto(session);
    }

    /** Difficulty drives the CEFR level sent to the model; 1..5 mirrors the client's slider. */
    private static void requireDifficulty(Integer difficultyLevel) {
        if (difficultyLevel == null || difficultyLevel < MIN_SCALE || difficultyLevel > MAX_SCALE) {
            throw new BadRequestException(
                    "difficultyLevel must be between " + MIN_SCALE + " and " + MAX_SCALE);
        }
    }

    /** Self-rated confidence is persisted on the session, so it must stay on the 1..5 scale. */
    private static void requireConfidence(Integer confidence) {
        if (confidence == null || confidence < MIN_SCALE || confidence > MAX_SCALE) {
            throw new BadRequestException(
                    "confidence must be between " + MIN_SCALE + " and " + MAX_SCALE);
        }
    }

    private GreetingSessionDto toDto(AiSpeakingSession session) {
        return new GreetingSessionDto(
                session.getId(),
                session.getUserId(),
                session.getTemplateId(),
                session.getDifficultyLevel(),
                session.getAiPrompt(),
                session.getAiResponse(),
                session.getUserInput(),
                session.getFeedback(),
                session.getUserConfidenceScore(),
                session.getSessionStatus(),
                session.getCreatedAt()
        );
    }
}
