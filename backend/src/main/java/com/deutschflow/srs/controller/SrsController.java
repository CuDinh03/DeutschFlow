package com.deutschflow.srs.controller;

import com.deutschflow.srs.dto.ReviewRequest;
import com.deutschflow.srs.dto.ScheduleVocabRequest;
import com.deutschflow.srs.dto.SrsDueCountDto;
import com.deutschflow.srs.dto.SrsStatsDto;
import com.deutschflow.srs.dto.VocabReviewCard;
import com.deutschflow.srs.service.SrsService;
import com.deutschflow.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST API for Spaced Repetition System (SRS).
 *
 * <h3>Algorithm:</h3>
 * FSRS-4.5 (new cards + SM-2 cards upgraded on first review — migrate-on-read).
 * The {@code quality} field in POST /review still accepts SM-2 scale 0-5
 * for backward compatibility; it is mapped to FSRS rating 1-4 internally.
 *
 * <h3>Endpoints:</h3>
 * <ul>
 *   <li>GET  /api/srs/due                — Cards due today (max 10)</li>
 *   <li>GET  /api/srs/count              — Count of due cards (for nav badge)</li>
 *   <li>GET  /api/srs/stats              — Summary stats</li>
 *   <li>POST /api/srs/schedule           — Schedule a single vocab item</li>
 *   <li>POST /api/srs/schedule/batch     — Schedule multiple vocab items</li>
 *   <li>POST /api/srs/review             — Record a review result (FSRS update)</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/srs")
@RequiredArgsConstructor
@Validated   // enables element-level validation on @RequestBody List<@Valid X> (BE-M3)
@PreAuthorize("hasRole('STUDENT')")
public class SrsController {

    private final SrsService srsService;

    /** Cards due today for review */
    @GetMapping("/due")
    public ResponseEntity<List<VocabReviewCard>> getDueCards(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(srsService.getDueCards(user.getId()));
    }

    /** Count of due cards — used for the 📚 badge in the navbar */
    @GetMapping("/count")
    public ResponseEntity<SrsDueCountDto> getDueCount(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(new SrsDueCountDto(srsService.countDue(user.getId())));
    }

    /** Stats summary for dashboard */
    @GetMapping("/stats")
    public ResponseEntity<SrsStatsDto> getStats(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(srsService.getStats(user.getId()));
    }

    /** Schedule a single vocab item (called after node completion) */
    @PostMapping("/schedule")
    public ResponseEntity<Void> scheduleVocab(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody ScheduleVocabRequest req) {
        srsService.scheduleVocab(user.getId(), req);
        return ResponseEntity.ok().build();
    }

    /** Schedule multiple vocab items in batch */
    @PostMapping("/schedule/batch")
    public ResponseEntity<Void> scheduleVocabBatch(
            @AuthenticationPrincipal User user,
            @RequestBody List<@Valid ScheduleVocabRequest> items) {
        srsService.scheduleVocabBatch(user.getId(), items);
        return ResponseEntity.ok().build();
    }

    /** Record a review result — routes to FSRS-4.5 (SM-2 cards upgraded transparently) */
    @PostMapping("/review")
    public ResponseEntity<VocabReviewCard> recordReview(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody ReviewRequest req) {
        return ResponseEntity.ok(srsService.recordReview(user.getId(), req));
    }

    /**
     * Batch review — processes offline queue accumulated while device was offline.
     * Reviews are applied in the order received; each result is independent.
     * Idempotent: re-sending a queued item with the same vocabId applies the rating again
     * (safe because FSRS is deterministic given current card state).
     */
    @PostMapping("/review/batch")
    public ResponseEntity<List<VocabReviewCard>> recordReviewBatch(
            @AuthenticationPrincipal User user,
            @RequestBody List<@Valid ReviewRequest> reviews) {
        if (reviews == null || reviews.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }
        List<VocabReviewCard> results = reviews.stream()
                .map(req -> srsService.recordReview(user.getId(), req))
                .toList();
        return ResponseEntity.ok(results);
    }
}
