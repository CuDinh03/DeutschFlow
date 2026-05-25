package com.deutschflow.vocabulary.controller;

import com.deutschflow.media.entity.MediaAsset;
import com.deutschflow.user.entity.User;
import com.deutschflow.vocabulary.dto.VocabularyImageReviewDecisionRequest;
import com.deutschflow.vocabulary.dto.VocabularyImageReviewResponse;
import com.deutschflow.vocabulary.service.VocabularyImageReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v2/admin/vocabulary/images/review")
@RequiredArgsConstructor
public class VocabularyImageReviewController {

    private final VocabularyImageReviewService reviewService;

    @GetMapping("/{wordId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<VocabularyImageReviewResponse> review(
            @PathVariable long wordId,
            @RequestParam(defaultValue = "8") int limit,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(reviewService.review(wordId, limit));
    }

    @PostMapping("/{wordId}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<MediaAsset> approve(
            @PathVariable long wordId,
            @RequestBody VocabularyImageReviewDecisionRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(reviewService.applyDecision(wordId, request));
    }
}
