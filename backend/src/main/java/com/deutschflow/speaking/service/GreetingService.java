package com.deutschflow.speaking.service;

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
        DialogueTemplate template = dialogueTemplateRepository.findById(templateId)
                .orElseThrow(() -> new IllegalArgumentException("Template not found: " + templateId));

        String cefrLevel = difficultyLevel != null && difficultyLevel <= 2 ? "A1" : "A2";
        AiChatCompletionResult dialogueResult = groqApiService.generateDialogueResponse(
                template.getUserPromptTemplate(), null, template.getTemplateName(), cefrLevel);
        if (dialogueResult.usage() != null) {
            ledgerService.record(userId, dialogueResult.provider(), dialogueResult.model(),
                    dialogueResult.usage().promptTokens(), dialogueResult.usage().completionTokens(),
                    dialogueResult.usage().totalTokens(), "GREETING_DIALOGUE", null, null);
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
        AiSpeakingSession session = aiSpeakingSessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        if (!session.getUserId().equals(userId)) {
            throw new SecurityException("Unauthorized access to session");
        }

        AiChatCompletionResult evalResult = groqApiService.evaluateAndFeedback(
                userInput, session.getAiResponse() != null ? session.getAiResponse() : "",
                "A1", session.getTemplateId() != null ? session.getTemplateId().toString() : "greeting");
        if (evalResult.usage() != null) {
            ledgerService.record(userId, evalResult.provider(), evalResult.model(),
                    evalResult.usage().promptTokens(), evalResult.usage().completionTokens(),
                    evalResult.usage().totalTokens(), "GREETING_EVAL", null, null);
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
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        if (!session.getUserId().equals(userId)) {
            throw new SecurityException("Unauthorized access to session");
        }

        return toDto(session);
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
