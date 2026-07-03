package com.deutschflow.moderation.controller;

import com.deutschflow.moderation.dto.ModerationDtos.BlockRequest;
import com.deutschflow.moderation.dto.ModerationDtos.BlockedUserDto;
import com.deutschflow.moderation.dto.ModerationDtos.ReportRequest;
import com.deutschflow.moderation.service.ContentReportService;
import com.deutschflow.moderation.service.UserBlockService;
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
 * UGC safety endpoints (Apple Guideline 1.2): block/unblock users and report content or users.
 * The caller is always the authenticated principal.
 */
@RestController
@RequestMapping("/api/moderation")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ModerationController {

    private final UserBlockService blockService;
    private final ContentReportService reportService;

    /** Block a user (idempotent). */
    @PostMapping("/block")
    public ResponseEntity<Void> block(@AuthenticationPrincipal User user, @Valid @RequestBody BlockRequest body) {
        blockService.block(user.getId(), body.userId());
        return ResponseEntity.noContent().build();
    }

    /** Unblock a user (idempotent). */
    @DeleteMapping("/block/{userId}")
    public ResponseEntity<Void> unblock(@AuthenticationPrincipal User user, @PathVariable Long userId) {
        blockService.unblock(user.getId(), userId);
        return ResponseEntity.noContent().build();
    }

    /** Users the caller has blocked (for the "Blocked users" management screen). */
    @GetMapping("/blocks")
    public List<BlockedUserDto> blocks(@AuthenticationPrincipal User user) {
        return blockService.listBlocked(user.getId());
    }

    /** Report a message or a user. Returns the created report id. */
    @PostMapping("/report")
    public Map<String, Long> report(@AuthenticationPrincipal User user, @Valid @RequestBody ReportRequest body) {
        return Map.of("reportId", reportService.report(user.getId(), body));
    }
}
