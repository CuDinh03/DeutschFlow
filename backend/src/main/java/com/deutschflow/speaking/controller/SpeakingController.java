package com.deutschflow.speaking.controller;

import com.deutschflow.speaking.dto.CreateGreetingSessionRequest;
import com.deutschflow.speaking.dto.GreetingSessionDto;
import com.deutschflow.speaking.dto.SubmitResponseRequest;
import com.deutschflow.speaking.service.GreetingService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai-speaking")
@CrossOrigin(origins = "${app.cors.allowed-origins:*}")
public class SpeakingController {

    private final GreetingService greetingService;

    public SpeakingController(GreetingService greetingService) {
        this.greetingService = greetingService;
    }

    @PostMapping("/greeting-session")
    public ResponseEntity<GreetingSessionDto> createGreetingSession(
            @RequestBody CreateGreetingSessionRequest request,
            Authentication authentication) {
        Long userId = getUserIdFromAuth(authentication);
        GreetingSessionDto session = greetingService.createGreetingSession(userId, request.templateId(), request.difficultyLevel());
        return ResponseEntity.ok(session);
    }

    @PostMapping("/greeting-session/{sessionId}/submit-response")
    public ResponseEntity<GreetingSessionDto> submitResponse(
            @PathVariable Long sessionId,
            @RequestBody SubmitResponseRequest request,
            Authentication authentication) {
        Long userId = getUserIdFromAuth(authentication);
        GreetingSessionDto result = greetingService.submitUserResponse(sessionId, userId, request.userInput(), request.confidence());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/greeting-session/{sessionId}")
    public ResponseEntity<GreetingSessionDto> getGreetingSession(
            @PathVariable Long sessionId,
            Authentication authentication) {
        Long userId = getUserIdFromAuth(authentication);
        GreetingSessionDto session = greetingService.getGreetingSession(sessionId, userId);
        return ResponseEntity.ok(session);
    }

    private Long getUserIdFromAuth(Authentication authentication) {
        // TODO: Extract user ID from JWT token or authentication principal
        // For now, return a placeholder
        return 1L;
    }
}
