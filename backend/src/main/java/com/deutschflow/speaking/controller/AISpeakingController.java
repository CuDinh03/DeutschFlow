package com.deutschflow.speaking.controller;

import com.deutschflow.speaking.controller.SpeakingAiHelperRequests.CulturalContextRequest;
import com.deutschflow.speaking.controller.SpeakingAiHelperRequests.ConversationRequest;
import com.deutschflow.speaking.controller.SpeakingAiHelperRequests.ErrorPracticeRequest;
import com.deutschflow.speaking.controller.SpeakingAiHelperRequests.FeedbackRequest;
import com.deutschflow.speaking.controller.SpeakingAiHelperRequests.RolePlayRequest;
import com.deutschflow.speaking.controller.SpeakingAiHelperRequests.ScenarioRequest;
import com.deutschflow.speaking.service.SpeakingAiHelpersService;
import com.deutschflow.speaking.service.SpeakingAiHelpersService.PracticeScenario;
import com.deutschflow.speaking.service.SpeakingAiHelpersService.SpeakingFeedback;
import jakarta.validation.Valid;
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
    public ResponseEntity<Map<String, String>> generateConversation(@Valid @RequestBody ConversationRequest request) {
        String response = speakingAiHelpersService.generateConversationResponse(
                request.message(),
                request.normalizedContext(),
                request.normalizedLevel());
        return ResponseEntity.ok(Map.of(
                "userMessage", request.message(),
                "aiResponse", response,
                "level", request.normalizedLevel()
        ));
    }

    /**
     * Get feedback on spoken German
     * POST /api/speaking/ai/feedback
     */
    @PostMapping("/feedback")
    public ResponseEntity<SpeakingFeedback> provideFeedback(@Valid @RequestBody FeedbackRequest request) {
        SpeakingFeedback feedback = speakingAiHelpersService.provideFeedback(request.text(), request.normalizedTopic());
        return ResponseEntity.ok(feedback);
    }

    /**
     * Generate practice scenario
     * POST /api/speaking/ai/scenario
     */
    @PostMapping("/scenario")
    public ResponseEntity<PracticeScenario> generateScenario(@Valid @RequestBody ScenarioRequest request) {
        PracticeScenario scenario = speakingAiHelpersService.generateScenario(request.topic(), request.normalizedLevel());
        return ResponseEntity.ok(scenario);
    }

    /**
     * Generate error-specific practice
     * POST /api/speaking/ai/error-practice
     */
    @PostMapping("/error-practice")
    public ResponseEntity<Map<String, Object>> generateErrorPractice(@Valid @RequestBody ErrorPracticeRequest request) {
        String practice = speakingAiHelpersService.generateErrorPractice(request.errorType(), request.normalizedExerciseCount());
        return ResponseEntity.ok(Map.of(
                "errorType", request.errorType(),
                "exercises", practice
        ));
    }

    /**
     * Get cultural context
     * POST /api/speaking/ai/cultural-context
     */
    @PostMapping("/cultural-context")
    public ResponseEntity<Map<String, String>> provideCulturalContext(@Valid @RequestBody CulturalContextRequest request) {
        String context = speakingAiHelpersService.provideCulturalContext(request.topic());
        return ResponseEntity.ok(Map.of(
                "topic", request.topic(),
                "culturalContext", context
        ));
    }

    /**
     * Generate role-play scenario
     * POST /api/speaking/ai/roleplay
     */
    @PostMapping("/roleplay")
    public ResponseEntity<Map<String, String>> generateRolePlay(@Valid @RequestBody RolePlayRequest request) {
        String rolePlay = speakingAiHelpersService.generateRolePlay(
                request.situation(),
                request.normalizedUserRole(),
                request.normalizedAiRole()
        );

        return ResponseEntity.ok(Map.of(
                "situation", request.situation(),
                "rolePlay", rolePlay
        ));
    }
}
