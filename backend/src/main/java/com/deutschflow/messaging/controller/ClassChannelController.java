package com.deutschflow.messaging.controller;

import com.deutschflow.messaging.dto.ClassChannelDtos.ClassMessageDto;
import com.deutschflow.messaging.dto.ClassChannelDtos.PostClassMessageRequest;
import com.deutschflow.messaging.service.ClassChannelService;
import com.deutschflow.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Class group channel (P6). Any authenticated user may call; the service restricts each channel
 * to members of that class (enrolled students + the class's teachers).
 */
@RestController
@RequestMapping("/api/v2/classes/{classId}/channel")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ClassChannelController {

    private final ClassChannelService channelService;

    /** Channel history (oldest-first), most recent 200. */
    @GetMapping("/messages")
    public List<ClassMessageDto> messages(@AuthenticationPrincipal User user, @PathVariable Long classId) {
        return channelService.listMessages(user.getId(), classId);
    }

    /** Post a message to the class channel. */
    @PostMapping("/messages")
    public ClassMessageDto post(@AuthenticationPrincipal User user,
                                @PathVariable Long classId,
                                @Valid @RequestBody PostClassMessageRequest body) {
        return channelService.post(user.getId(), classId, body.body());
    }

    /** Soft-delete a message (own message, or any if the caller is a teacher of the class). */
    @DeleteMapping("/messages/{messageId}")
    public ClassMessageDto delete(@AuthenticationPrincipal User user,
                                  @PathVariable Long classId,
                                  @PathVariable Long messageId) {
        return channelService.delete(user.getId(), classId, messageId);
    }
}
