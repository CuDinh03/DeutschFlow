package com.deutschflow.speaking.controller;

import com.deutschflow.speaking.service.SpeakingAiHelpersService;
import com.deutschflow.speaking.service.SpeakingAiHelpersService.PracticeScenario;
import com.deutschflow.speaking.service.SpeakingAiHelpersService.SpeakingFeedback;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST API for AI-powered speaking practice features
 */
@Slf4j
@RestController
@RequestMapping("/api/speaking/ai")
@RequiredArgsConstructor
public class AISpeakingController {

    private final SpeakingAiHelpersService speakingAiHelpersService;

    /**
     * Generate conversation response
     * POST /api/speaking/ai/conversation
     */
    @PostMapping("/conversation")
    public ResponseEntity<Map<String, String>> generateConversation(@RequestBody Map<String, String> request) {
        String userMessage = request.get("message");
        String context = request.getOrDefault("context", "");
        String level = request.getOrDefault("level", "A2");

        if (userMessage == null || userMessage.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        String response = speakingAiHelpersService.generateConversationResponse(userMessage, context, level);
        return ResponseEntity.ok(Map.of(
                "userMessage", userMessage,
                "aiResponse", response,
                "level", level
        ));
    }

    /**
     * Get feedback on spoken German
     * POST /api/speaking/ai/feedback
     */
    @PostMapping("/feedback")
    public ResponseEntity<SpeakingFeedback> provideFeedback(@RequestBody Map<String, String> request) {
        String userText = request.get("text");
        String expectedTopic = request.getOrDefault("topic", "");

        if (userText == null || userText.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        SpeakingFeedback feedback = speakingAiHelpersService.provideFeedback(userText, expectedTopic);
        return ResponseEntity.ok(feedback);
    }

    /**
     * Generate practice scenario
     * POST /api/speaking/ai/scenario
     */
    @PostMapping("/scenario")
    public ResponseEntity<PracticeScenario> generateScenario(@RequestBody Map<String, String> request) {
        String topic = request.get("topic");
        String level = request.getOrDefault("level", "A2");

        if (topic == null || topic.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        PracticeScenario scenario = speakingAiHelpersService.generateScenario(topic, level);
        return ResponseEntity.ok(scenario);
    }

    /**
     * Generate error-specific practice
     * POST /api/speaking/ai/error-practice
     */
    @PostMapping("/error-practice")
    public ResponseEntity<Map<String, Object>> generateErrorPractice(@RequestBody Map<String, Object> request) {
        String errorType = (String) request.get("errorType");
        Integer exerciseCount = request.containsKey("exerciseCount")
                ? (Integer) request.get("exerciseCount")
                : 3;

        if (errorType == null || errorType.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        String practice = speakingAiHelpersService.generateErrorPractice(errorType, exerciseCount);
        return ResponseEntity.ok(Map.of(
                "errorType", errorType,
                "exercises", practice
        ));
    }

    /**
     * Get cultural context
     * POST /api/speaking/ai/cultural-context
     */
    @PostMapping("/cultural-context")
    public ResponseEntity<Map<String, String>> provideCulturalContext(@RequestBody Map<String, String> request) {
        String topic = request.get("topic");

        if (topic == null || topic.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        String context = speakingAiHelpersService.provideCulturalContext(topic);
        return ResponseEntity.ok(Map.of(
                "topic", topic,
                "culturalContext", context
        ));
    }

    /**
     * Generate role-play scenario
     * POST /api/speaking/ai/roleplay
     */
    @PostMapping("/roleplay")
    public ResponseEntity<Map<String, String>> generateRolePlay(@RequestBody Map<String, String> request) {
        String situation = request.get("situation");
        String userRole = request.get("userRole");
        String aiRole = request.get("aiRole");

        if (situation == null || situation.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        String rolePlay = speakingAiHelpersService.generateRolePlay(
                situation,
                userRole != null ? userRole : "customer",
                aiRole != null ? aiRole : "shopkeeper"
        );

        return ResponseEntity.ok(Map.of(
                "situation", situation,
                "rolePlay", rolePlay
        ));
    }
}
