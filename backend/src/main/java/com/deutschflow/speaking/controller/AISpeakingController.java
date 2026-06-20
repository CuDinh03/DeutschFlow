package com.deutschflow.speaking.controller;

import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.speaking.controller.SpeakingAiHelperRequests.CulturalContextRequest;
import com.deutschflow.speaking.controller.SpeakingAiHelperRequests.ConversationRequest;
import com.deutschflow.speaking.controller.SpeakingAiHelperRequests.ErrorPracticeRequest;
import com.deutschflow.speaking.controller.SpeakingAiHelperRequests.FeedbackRequest;
import com.deutschflow.speaking.controller.SpeakingAiHelperRequests.RolePlayRequest;
import com.deutschflow.speaking.controller.SpeakingAiHelperRequests.ScenarioRequest;
import com.deutschflow.speaking.service.SpeakingAiHelpersService;
import com.deutschflow.speaking.service.SpeakingAiHelpersService.PracticeScenario;
import com.deutschflow.speaking.service.SpeakingAiHelpersService.SpeakingFeedback;
import com.deutschflow.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;

/**
 * REST API for AI-powered speaking practice features.
 * All endpoints require authentication and are subject to personal + org token quota.
 */
@Slf4j
@RestController
@RequestMapping("/api/speaking/ai")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class AISpeakingController {

    private static final long ESTIMATED_MIN_TOKENS = 300L;

    private final SpeakingAiHelpersService speakingAiHelpersService;
    private final QuotaService quotaService;
    private final OrgPoolGuard orgPoolGuard;

    /**
     * POST /api/speaking/ai/conversation
     */
    @PostMapping("/conversation")
    public ResponseEntity<Map<String, String>> generateConversation(
            @Valid @RequestBody ConversationRequest request,
            @AuthenticationPrincipal User user) {
        long userId = user.getId();
        quotaService.assertAllowed(userId, Instant.now(), ESTIMATED_MIN_TOKENS);
        orgPoolGuard.assertOrgPoolAvailable(userId, ESTIMATED_MIN_TOKENS);

        String response = speakingAiHelpersService.generateConversationResponse(
                userId,
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
     * POST /api/speaking/ai/feedback
     */
    @PostMapping("/feedback")
    public ResponseEntity<SpeakingFeedback> provideFeedback(
            @Valid @RequestBody FeedbackRequest request,
            @AuthenticationPrincipal User user) {
        long userId = user.getId();
        quotaService.assertAllowed(userId, Instant.now(), ESTIMATED_MIN_TOKENS);
        orgPoolGuard.assertOrgPoolAvailable(userId, ESTIMATED_MIN_TOKENS);

        SpeakingFeedback feedback = speakingAiHelpersService.provideFeedback(
                userId, request.text(), request.normalizedTopic());
        return ResponseEntity.ok(feedback);
    }

    /**
     * POST /api/speaking/ai/scenario
     */
    @PostMapping("/scenario")
    public ResponseEntity<PracticeScenario> generateScenario(
            @Valid @RequestBody ScenarioRequest request,
            @AuthenticationPrincipal User user) {
        long userId = user.getId();
        quotaService.assertAllowed(userId, Instant.now(), ESTIMATED_MIN_TOKENS);
        orgPoolGuard.assertOrgPoolAvailable(userId, ESTIMATED_MIN_TOKENS);

        PracticeScenario scenario = speakingAiHelpersService.generateScenario(
                userId, request.topic(), request.normalizedLevel());
        return ResponseEntity.ok(scenario);
    }

    /**
     * POST /api/speaking/ai/error-practice
     */
    @PostMapping("/error-practice")
    public ResponseEntity<Map<String, Object>> generateErrorPractice(
            @Valid @RequestBody ErrorPracticeRequest request,
            @AuthenticationPrincipal User user) {
        long userId = user.getId();
        quotaService.assertAllowed(userId, Instant.now(), ESTIMATED_MIN_TOKENS);
        orgPoolGuard.assertOrgPoolAvailable(userId, ESTIMATED_MIN_TOKENS);

        String practice = speakingAiHelpersService.generateErrorPractice(
                userId, request.errorType(), request.normalizedExerciseCount());
        return ResponseEntity.ok(Map.of(
                "errorType", request.errorType(),
                "exercises", practice
        ));
    }

    /**
     * POST /api/speaking/ai/cultural-context
     */
    @PostMapping("/cultural-context")
    public ResponseEntity<Map<String, String>> provideCulturalContext(
            @Valid @RequestBody CulturalContextRequest request,
            @AuthenticationPrincipal User user) {
        long userId = user.getId();
        quotaService.assertAllowed(userId, Instant.now(), ESTIMATED_MIN_TOKENS);
        orgPoolGuard.assertOrgPoolAvailable(userId, ESTIMATED_MIN_TOKENS);

        String context = speakingAiHelpersService.provideCulturalContext(userId, request.topic());
        return ResponseEntity.ok(Map.of(
                "topic", request.topic(),
                "culturalContext", context
        ));
    }

    /**
     * POST /api/speaking/ai/roleplay
     */
    @PostMapping("/roleplay")
    public ResponseEntity<Map<String, String>> generateRolePlay(
            @Valid @RequestBody RolePlayRequest request,
            @AuthenticationPrincipal User user) {
        long userId = user.getId();
        quotaService.assertAllowed(userId, Instant.now(), ESTIMATED_MIN_TOKENS);
        orgPoolGuard.assertOrgPoolAvailable(userId, ESTIMATED_MIN_TOKENS);

        String rolePlay = speakingAiHelpersService.generateRolePlay(
                userId,
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
