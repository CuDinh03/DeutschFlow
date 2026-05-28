package com.deutschflow.vocabulary.controller;

import com.deutschflow.vocabulary.dto.LearningProgressDto;
import com.deutschflow.vocabulary.dto.RecordReviewRequest;
import com.deutschflow.vocabulary.service.SpacedRepetitionService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
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
            @AuthenticationPrincipal UserDetails principal) {
        spacedRepetitionService.recordReview(userId(principal), request.wordId(), request.confidence());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/progress")
    public ResponseEntity<LearningProgressDto> getLearningProgress(
            @AuthenticationPrincipal UserDetails principal) {
        LearningProgressDto progress = spacedRepetitionService.getLearningProgress(userId(principal));
        return ResponseEntity.ok(progress);
    }

    private long userId(UserDetails p) {
        if (p instanceof com.deutschflow.user.entity.User user) {
            return user.getId();
        }
        try { return Long.parseLong(p.getUsername()); }
        catch (Exception e) { throw new RuntimeException("Cannot resolve user ID"); }
    }
}
