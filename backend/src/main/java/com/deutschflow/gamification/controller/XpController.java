package com.deutschflow.gamification.controller;

import com.deutschflow.gamification.dto.LeaderboardDto;
import com.deutschflow.gamification.dto.XpSummaryDto;
import com.deutschflow.gamification.service.XpService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * XP & Gamification REST API.
 *
 * GET  /api/xp/me                — Full XP summary + achievements + pending badges
 * POST /api/xp/me/badges/ack    — Mark all pending badges as notified (call after toast shown)
 * GET  /api/xp/leaderboard      — Top-N users by total XP (displayName + XP only)
 */
@RestController
@RequestMapping("/api/xp")
@RequiredArgsConstructor
public class XpController {

    private final XpService xpService;

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<XpSummaryDto> getSummary(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(xpService.getSummary(user.getId()));
    }

    @PostMapping("/me/badges/ack")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> acknowledgeBadges(@AuthenticationPrincipal User user) {
        xpService.markBadgesNotified(user.getId());
        return ResponseEntity.ok().build();
    }

    /**
     * GET /api/xp/leaderboard?limit=20
     * Returns top-N users ranked by XP. Safe to expose: only displayName + XP.
     */
    @GetMapping("/leaderboard")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<LeaderboardDto>> leaderboard(
            @RequestParam(defaultValue = "20") int limit,
            @AuthenticationPrincipal User currentUser
    ) {
        List<LeaderboardDto> board = xpService.getLeaderboard(Math.min(limit, 50));
        return ResponseEntity.ok(board);
    }
}

