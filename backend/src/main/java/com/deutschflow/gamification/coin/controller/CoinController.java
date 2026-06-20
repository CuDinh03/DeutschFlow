package com.deutschflow.gamification.coin.controller;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.gamification.coin.dto.CoinBalanceDto;
import com.deutschflow.gamification.coin.dto.CoinEventDto;
import com.deutschflow.gamification.coin.service.CoinService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Student coin wallet REST API.
 *
 * <pre>
 * GET  /api/coins/me                       — current balance
 * GET  /api/coins/history?page=&size=      — ledger (newest first)
 * GET  /api/coins/mock-trial-passes?packId — { hasActivePass }
 * POST /api/coins/mock-trial-passes        — buy a single-attempt trial pass { packId }
 * GET  /api/coins/bonus-speaking-sessions  — { tokensToday }
 * POST /api/coins/bonus-speaking-sessions  — buy a one-day AI-speaking token top-up
 * </pre>
 */
@RestController
@RequestMapping("/api/coins")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class CoinController {

    private static final int MAX_HISTORY_PAGE_SIZE = 100;

    private final CoinService coinService;

    @GetMapping("/me")
    public ResponseEntity<CoinBalanceDto> balance(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(coinService.getBalance(user.getId()));
    }

    @GetMapping("/history")
    public ResponseEntity<List<CoinEventDto>> history(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int safeSize = Math.min(Math.max(size, 1), MAX_HISTORY_PAGE_SIZE);
        return ResponseEntity.ok(coinService.history(user.getId(), PageRequest.of(Math.max(page, 0), safeSize)));
    }

    @GetMapping("/mock-trial-passes")
    public ResponseEntity<Map<String, Object>> trialPassStatus(
            @AuthenticationPrincipal User user,
            @RequestParam Long packId) {
        return ResponseEntity.ok(Map.of("hasActivePass", coinService.hasTrialPassFor(user.getId(), packId)));
    }

    @PostMapping("/mock-trial-passes")
    public ResponseEntity<CoinBalanceDto> buyTrialPass(
            @AuthenticationPrincipal User user,
            @RequestBody BuyTrialPassRequest request) {
        if (request == null || request.packId() == null) {
            throw new BadRequestException("packId is required.");
        }
        coinService.purchaseTrialPass(user.getId(), request.packId());
        return ResponseEntity.ok(coinService.getBalance(user.getId()));
    }

    @GetMapping("/bonus-speaking-sessions")
    public ResponseEntity<Map<String, Object>> bonusSpeakingStatus(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(Map.of("tokensToday", coinService.bonusSpeakingTokensToday(user.getId())));
    }

    @PostMapping("/bonus-speaking-sessions")
    public ResponseEntity<CoinBalanceDto> buyBonusSpeaking(@AuthenticationPrincipal User user) {
        coinService.purchaseBonusSpeakingSession(user.getId());
        return ResponseEntity.ok(coinService.getBalance(user.getId()));
    }

    public record BuyTrialPassRequest(Long packId) {}
}
