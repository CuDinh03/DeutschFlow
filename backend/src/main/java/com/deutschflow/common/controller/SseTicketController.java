package com.deutschflow.common.controller;

import com.deutschflow.common.security.SseTicketService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Issues short-lived, single-use SSE tickets (S15) so EventSource connections don't need the access
 * token in the URL. Requires a normal Bearer-authenticated request; the ticket is bound to the
 * caller and consumed by {@link com.deutschflow.common.security.JwtAuthFilter} on connect.
 */
@RestController
@RequestMapping("/api/sse")
@RequiredArgsConstructor
public class SseTicketController {

    private final SseTicketService sseTicketService;

    /** POST /api/sse/ticket → { "ticket": "...", "expiresInSeconds": 60 } */
    @PostMapping("/ticket")
    public Map<String, Object> issueTicket(@AuthenticationPrincipal User user) {
        String ticket = sseTicketService.issue(user.getEmail());
        return Map.of("ticket", ticket, "expiresInSeconds", sseTicketService.ttlSeconds());
    }
}
