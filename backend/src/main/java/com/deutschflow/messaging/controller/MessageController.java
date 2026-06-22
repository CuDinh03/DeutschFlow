package com.deutschflow.messaging.controller;

import com.deutschflow.messaging.dto.MessagingDtos.ConversationDto;
import com.deutschflow.messaging.dto.MessagingDtos.MessageDto;
import com.deutschflow.messaging.dto.MessagingDtos.SendMessageRequest;
import com.deutschflow.messaging.service.MessageService;
import com.deutschflow.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Direct student ↔ teacher messaging. Any authenticated user may call; the service restricts each
 * thread to a counterpart who shares a class (teacher↔student). The caller is always the principal.
 */
@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class MessageController {

    private final MessageService messageService;

    /** Conversation summaries (one per counterpart), most-recent first. */
    @GetMapping("/conversations")
    public List<ConversationDto> conversations(@AuthenticationPrincipal User user) {
        return messageService.listConversations(user.getId());
    }

    /** Total unread across all threads — for a global badge. */
    @GetMapping("/unread-count")
    public Map<String, Long> unreadCount(@AuthenticationPrincipal User user) {
        return Map.of("count", messageService.totalUnread(user.getId()));
    }

    /** Full thread with another user; marks incoming messages read. */
    @GetMapping("/with/{userId}")
    public List<MessageDto> thread(@AuthenticationPrincipal User user, @PathVariable Long userId) {
        return messageService.getThread(user.getId(), userId);
    }

    /** Send a message (recipient must share a class with the caller). */
    @PostMapping
    public MessageDto send(@AuthenticationPrincipal User user, @Valid @RequestBody SendMessageRequest body) {
        return messageService.send(user.getId(), body.recipientId(), body.body());
    }

    /** Explicitly mark a thread read (e.g. on swipe), without fetching it. */
    @PostMapping("/with/{userId}/read")
    public ResponseEntity<Void> markRead(@AuthenticationPrincipal User user, @PathVariable Long userId) {
        messageService.markRead(user.getId(), userId);
        return ResponseEntity.noContent().build();
    }
}
