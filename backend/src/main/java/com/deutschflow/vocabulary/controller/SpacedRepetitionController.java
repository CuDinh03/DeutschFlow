package com.deutschflow.vocabulary.controller;

import com.deutschflow.vocabulary.dto.LearningProgressDto;
import com.deutschflow.vocabulary.dto.RecordReviewRequest;
import com.deutschflow.vocabulary.service.SpacedRepetitionService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/vocabulary/srs")
@CrossOrigin(origins = "${app.cors.allowed-origins:*}")
public class SpacedRepetitionController {

    private final SpacedRepetitionService spacedRepetitionService;

    public SpacedRepetitionController(SpacedRepetitionService spacedRepetitionService) {
        this.spacedRepetitionService = spacedRepetitionService;
    }

    @PostMapping("/record-review")
    public ResponseEntity<Void> recordReview(
            @RequestBody RecordReviewRequest request,
            Authentication authentication) {
        Long userId = getUserIdFromAuth(authentication);
        spacedRepetitionService.recordReview(userId, request.wordId(), request.confidence());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/progress")
    public ResponseEntity<LearningProgressDto> getLearningProgress(
            Authentication authentication) {
        Long userId = getUserIdFromAuth(authentication);
        LearningProgressDto progress = spacedRepetitionService.getLearningProgress(userId);
        return ResponseEntity.ok(progress);
    }

    private Long getUserIdFromAuth(Authentication authentication) {
        // TODO: Extract user ID from JWT token or authentication principal
        // For now, return a placeholder
        return 1L;
    }
}
