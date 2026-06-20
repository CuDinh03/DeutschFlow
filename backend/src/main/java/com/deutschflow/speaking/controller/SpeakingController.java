package com.deutschflow.speaking.controller;

import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.speaking.dto.CreateGreetingSessionRequest;
import com.deutschflow.speaking.dto.GreetingSessionDto;
import com.deutschflow.speaking.dto.SubmitResponseRequest;
import com.deutschflow.speaking.service.GreetingService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

@RestController
@RequestMapping("/api/ai-speaking")
@PreAuthorize("isAuthenticated()")
public class SpeakingController {

    private static final long GREETING_ESTIMATED_TOKENS = 300L;

    private final GreetingService greetingService;
    private final QuotaService quotaService;
    private final OrgPoolGuard orgPoolGuard;

    public SpeakingController(GreetingService greetingService,
                               QuotaService quotaService,
                               OrgPoolGuard orgPoolGuard) {
        this.greetingService = greetingService;
        this.quotaService = quotaService;
        this.orgPoolGuard = orgPoolGuard;
    }

    @PostMapping("/greeting-session")
    public ResponseEntity<GreetingSessionDto> createGreetingSession(
            @RequestBody CreateGreetingSessionRequest request,
            @AuthenticationPrincipal UserDetails principal) {
        long userId = userId(principal);
        quotaService.assertAllowed(userId, Instant.now(), GREETING_ESTIMATED_TOKENS);
        orgPoolGuard.assertOrgPoolAvailable(userId, GREETING_ESTIMATED_TOKENS);
        GreetingSessionDto session = greetingService.createGreetingSession(
                userId, request.templateId(), request.difficultyLevel());
        return ResponseEntity.ok(session);
    }

    @PostMapping("/greeting-session/{sessionId}/submit-response")
    public ResponseEntity<GreetingSessionDto> submitResponse(
            @PathVariable Long sessionId,
            @RequestBody SubmitResponseRequest request,
            @AuthenticationPrincipal UserDetails principal) {
        long userId = userId(principal);
        quotaService.assertAllowed(userId, Instant.now(), GREETING_ESTIMATED_TOKENS);
        orgPoolGuard.assertOrgPoolAvailable(userId, GREETING_ESTIMATED_TOKENS);
        GreetingSessionDto result = greetingService.submitUserResponse(
                sessionId, userId, request.userInput(), request.confidence());
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
