package com.deutschflow.speaking.controller;

import com.deutschflow.speaking.RateLimiterService;
import com.deutschflow.speaking.dto.*;
import com.deutschflow.speaking.exception.AiServiceException;
import com.deutschflow.speaking.service.AiSpeakingService;
import com.deutschflow.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * REST controller for the DeutschFlow AI Speaking Practice feature.
 *
 * <p>All endpoints require a valid JWT token (enforced by {@code JwtAuthFilter}).
 */
@RestController
@RequestMapping("/api/ai-speaking")
@RequiredArgsConstructor
public class AiSpeakingController {

    private static final List<Pattern> PROMPT_INJECTION_PATTERNS = List.of(
            Pattern.compile("ignore\\s+(previous|all)\\s+instructions", Pattern.CASE_INSENSITIVE),
            Pattern.compile("you\\s+are\\s+now", Pattern.CASE_INSENSITIVE),
            Pattern.compile("disregard\\s+(all|previous|your)", Pattern.CASE_INSENSITIVE),
            Pattern.compile("forget\\s+(everything|all|your)", Pattern.CASE_INSENSITIVE),
            Pattern.compile("act\\s+as\\s+(if|a|an)", Pattern.CASE_INSENSITIVE),
            Pattern.compile("new\\s+instructions?:", Pattern.CASE_INSENSITIVE),
            Pattern.compile("system\\s*prompt", Pattern.CASE_INSENSITIVE)
    );

    private final AiSpeakingService aiSpeakingService;
    private final RateLimiterService rateLimiterService;

    /**
     * POST /api/ai-speaking/sessions — Create a new speaking practice session.
     */
    @PostMapping("/sessions")
    @ResponseStatus(HttpStatus.CREATED)
    public AiSpeakingSessionDto createSession(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody(required = false) CreateSessionRequest request) {
        String topic = request != null ? request.topic() : null;
        return aiSpeakingService.createSession(user.getId(), topic);
    }

    /**
     * POST /api/ai-speaking/sessions/{sessionId}/chat — Send a message and receive AI feedback.
     */
    @PostMapping("/sessions/{sessionId}/chat")
    public ResponseEntity<?> chat(
            @AuthenticationPrincipal User user,
            @PathVariable Long sessionId,
            @Valid @RequestBody AiSpeakingChatRequest request) {

        // Rate limiting check
        if (!rateLimiterService.checkAndRecord(user.getId())) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("error", "Rate limit exceeded. Please wait before sending more messages."));
        }

        // Prompt injection guard
        if (containsPromptInjection(request.userMessage())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Message contains disallowed content."));
        }

        AiSpeakingChatResponse response = aiSpeakingService.chat(user.getId(), sessionId, request.userMessage());
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/ai-speaking/sessions/{sessionId}/messages — Get conversation history.
     */
    @GetMapping("/sessions/{sessionId}/messages")
    public List<AiSpeakingMessageDto> getMessages(
            @AuthenticationPrincipal User user,
            @PathVariable Long sessionId) {
        return aiSpeakingService.getMessages(user.getId(), sessionId);
    }

    /**
     * GET /api/ai-speaking/sessions — Get paginated list of user's sessions.
     */
    @GetMapping("/sessions")
    public Page<AiSpeakingSessionDto> getSessions(
            @AuthenticationPrincipal User user,
            @PageableDefault(size = 10) Pageable pageable) {
        return aiSpeakingService.getSessions(user.getId(), pageable);
    }

    /**
     * PATCH /api/ai-speaking/sessions/{sessionId}/end — End a speaking session.
     */
    @PatchMapping("/sessions/{sessionId}/end")
    public AiSpeakingSessionDto endSession(
            @AuthenticationPrincipal User user,
            @PathVariable Long sessionId) {
        return aiSpeakingService.endSession(user.getId(), sessionId);
    }

    /**
     * Handle AiServiceException → 503 Service Unavailable.
     */
    @ExceptionHandler(AiServiceException.class)
    public ResponseEntity<Map<String, String>> handleAiServiceException(AiServiceException ex) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("error", ex.getMessage()));
    }

    // --- Private helpers ---

    private boolean containsPromptInjection(String message) {
        if (message == null) return false;
        return PROMPT_INJECTION_PATTERNS.stream()
                .anyMatch(pattern -> pattern.matcher(message).find());
    }
}
