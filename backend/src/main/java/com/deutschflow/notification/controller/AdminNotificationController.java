package com.deutschflow.notification.controller;

import com.deutschflow.notification.dto.BroadcastNotificationRequest;
import com.deutschflow.notification.dto.BroadcastNotificationResponse;
import com.deutschflow.notification.service.UserNotificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/notifications")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminNotificationController {

    private final UserNotificationService userNotificationService;

    /**
     * POST /api/admin/notifications/broadcast
     *
     * Sends an in-app notification to every user matching the requested audience.
     * The operation runs asynchronously; the response indicates the number of
     * recipients enqueued, not necessarily delivered.
     *
     * audienceType values:
     *   ALL          — every active user
     *   TIER         — active users whose current subscription matches {@code tier}
     *   ROLE         — active users with the given {@code role}
     *   SINGLE_USER  — the single active user identified by {@code targetEmail}
     */
    @PostMapping("/broadcast")
    public ResponseEntity<BroadcastNotificationResponse> broadcast(
            @Valid @RequestBody BroadcastNotificationRequest request
    ) {
        BroadcastNotificationResponse response = userNotificationService.broadcastToAudience(request);
        return ResponseEntity.ok(response);
    }
}
