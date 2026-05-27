package com.deutschflow.speaking.service;

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

    public GreetingService(
            AiSpeakingSessionRepository aiSpeakingSessionRepository,
            DialogueTemplateRepository dialogueTemplateRepository) {
        this.aiSpeakingSessionRepository = aiSpeakingSessionRepository;
        this.dialogueTemplateRepository = dialogueTemplateRepository;
    }

    @Transactional
    public GreetingSessionDto createGreetingSession(Long userId, Long templateId, Integer difficultyLevel) {
        DialogueTemplate template = dialogueTemplateRepository.findById(templateId)
                .orElseThrow(() -> new IllegalArgumentException("Template not found: " + templateId));

        // TODO: Call Groq API to generate AI prompt based on template
        String aiPrompt = "Greetings! How would you like to respond?";
        String aiResponse = "Hallo! Wie heißt du?";

        AiSpeakingSession session = new AiSpeakingSession();
        session.setUserId(userId);
        session.setTemplateId(templateId);
        session.setDifficultyLevel(difficultyLevel);
        session.setSessionMode("GREETING");
        session.setSessionStatus("IN_PROGRESS");
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

        // TODO: Call Groq API to evaluate user response
        String feedback = "Good try! Here's a correction: " + userInput;

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
