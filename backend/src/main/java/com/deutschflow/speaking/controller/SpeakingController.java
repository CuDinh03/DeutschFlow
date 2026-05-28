package com.deutschflow.speaking.controller;

import com.deutschflow.speaking.dto.CreateGreetingSessionRequest;
import com.deutschflow.speaking.dto.GreetingSessionDto;
import com.deutschflow.speaking.dto.SubmitResponseRequest;
import com.deutschflow.speaking.service.GreetingService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
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
            @AuthenticationPrincipal UserDetails principal) {
        GreetingSessionDto session = greetingService.createGreetingSession(
                userId(principal), request.templateId(), request.difficultyLevel());
        return ResponseEntity.ok(session);
    }

    @PostMapping("/greeting-session/{sessionId}/submit-response")
    public ResponseEntity<GreetingSessionDto> submitResponse(
            @PathVariable Long sessionId,
            @RequestBody SubmitResponseRequest request,
            @AuthenticationPrincipal UserDetails principal) {
        GreetingSessionDto result = greetingService.submitUserResponse(
                sessionId, userId(principal), request.userInput(), request.confidence());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/greeting-session/{sessionId}")
    public ResponseEntity<GreetingSessionDto> getGreetingSession(
            @PathVariable Long sessionId,
            @AuthenticationPrincipal UserDetails principal) {
        GreetingSessionDto session = greetingService.getGreetingSession(sessionId, userId(principal));
        return ResponseEntity.ok(session);
    }

    private long userId(UserDetails p) {
        if (p instanceof com.deutschflow.user.entity.User user) {
            return user.getId();
        }
        try { return Long.parseLong(p.getUsername()); }
        catch (Exception e) { throw new RuntimeException("Cannot resolve user ID"); }
    }
}
