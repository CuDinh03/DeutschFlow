package com.deutschflow.notification.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.notification.dto.BroadcastNotificationRequest;
import com.deutschflow.notification.dto.BroadcastNotificationResponse;
import com.deutschflow.notification.service.UserNotificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/notifications")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminNotificationController {

    private final UserNotificationService userNotificationService;
    private final AuditLogService auditLogService;

    /**
     * POST /api/admin/notifications/broadcast/preview
     *
     * Resolves the requested audience and returns how many active users it would reach — WITHOUT
     * sending anything. The admin UI calls this before showing the "gửi tới N người?" confirm, so a
     * mass push is never one accidental click away.
     */
    @PostMapping("/broadcast/preview")
    public ResponseEntity<Map<String, Object>> previewBroadcast(
            @Valid @RequestBody BroadcastNotificationRequest request
    ) {
        long recipientCount = userNotificationService.countAudience(request);
        return ResponseEntity.ok(Map.of(
                "recipientCount", recipientCount,
                "audienceType", request.audienceType()));
    }

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
            @Valid @RequestBody BroadcastNotificationRequest request,
            Authentication authentication
    ) {
        BroadcastNotificationResponse response = userNotificationService.broadcastToAudience(request);
        // Mass, effectively-irreversible outbound action → audit who sent what to whom (had none before).
        auditLogService.log(
                "admin.notification.broadcast",
                AuditActor.ofAuthentication(authentication),
                "NOTIFICATION",
                request.audienceType(),
                broadcastMetadata(request, response));
        return ResponseEntity.ok(response);
    }

    /**
     * Audit F-M4 (03/09/2026): vết cũ chỉ ghi {@code audienceType}, nên một broadcast SINGLE_USER
     * để lại đúng chữ "SINGLE_USER" — không biết đã gửi cho AI. Với TIER/ROLE cũng vậy: hai lần
     * gửi tới hai tầng khác nhau nhìn giống hệt nhau trong nhật ký. Ghi thêm tiêu chí chọn đối tượng.
     */
    private Map<String, Object> broadcastMetadata(BroadcastNotificationRequest request,
                                                  BroadcastNotificationResponse response) {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("audienceType", request.audienceType());
        meta.put("title", request.payload().title());
        meta.put("recipientCount", response.recipientCount());
        meta.put("status", response.status());
        if (request.targetEmail() != null && !request.targetEmail().isBlank()) {
            meta.put("targetEmail", request.targetEmail());
        }
        if (request.tier() != null && !request.tier().isBlank()) {
            meta.put("tier", request.tier());
        }
        if (request.role() != null && !request.role().isBlank()) {
            meta.put("role", request.role());
        }
        return meta;
    }
}
