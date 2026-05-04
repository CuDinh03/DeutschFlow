package com.deutschflow.notification.controller;

import com.deutschflow.common.exception.RateLimitExceededException;
import com.deutschflow.notification.NotificationRateLimiterService;
import com.deutschflow.notification.dto.MarkNotificationsReadResponse;
import com.deutschflow.notification.dto.NotificationPageResponse;
import com.deutschflow.notification.dto.NotificationUnreadCountResponse;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.notification.sse.NotificationSseBroadcaster;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class UserNotificationController {

    private final UserNotificationService userNotificationService;
    private final NotificationSseBroadcaster notificationSseBroadcaster;
    private final NotificationRateLimiterService notificationRateLimiterService;

    @Value("${app.notifications.sse.timeout-ms:900000}")
    private long notificationSseTimeoutMs;

    @GetMapping
    public NotificationPageResponse list(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) Boolean unreadOnly
    ) {
        enforceReadPoll(user);
        return userNotificationService.listForRecipient(user.getId(), page, size, unreadOnly);
    }

    @GetMapping("/unread-count")
    public NotificationUnreadCountResponse unreadCount(@AuthenticationPrincipal User user) {
        enforceReadPoll(user);
        return userNotificationService.unreadCount(user.getId());
    }

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@AuthenticationPrincipal User user) {
        if (!notificationRateLimiterService.allowStreamConnect(user.getId())) {
            int retry = notificationRateLimiterService.retryAfterSeconds("sse");
            throw new RateLimitExceededException("Too many notification stream connections.", retry);
        }
        long timeoutMs = notificationSseTimeoutMs > 0 ? notificationSseTimeoutMs : 900_000L;
        return notificationSseBroadcaster.register(user.getId(), timeoutMs);
    }

    @PostMapping("/{id}/read")
    public MarkNotificationsReadResponse markRead(
            @AuthenticationPrincipal User user,
            @PathVariable("id") long id
    ) {
        enforceMutate(user);
        return userNotificationService.markRead(user.getId(), id);
    }

    @PostMapping("/read-all")
    public MarkNotificationsReadResponse markAllRead(@AuthenticationPrincipal User user) {
        enforceMutate(user);
        return userNotificationService.markAllRead(user.getId());
    }

    private void enforceReadPoll(User user) {
        if (!notificationRateLimiterService.allowReadPoll(user.getId())) {
            int retry = notificationRateLimiterService.retryAfterSeconds("poll");
            throw new RateLimitExceededException("Too many notification read requests.", retry);
        }
    }

    private void enforceMutate(User user) {
        if (!notificationRateLimiterService.allowMutate(user.getId())) {
            int retry = notificationRateLimiterService.retryAfterSeconds("mutate");
            throw new RateLimitExceededException("Too many notification update requests.", retry);
        }
    }
}
