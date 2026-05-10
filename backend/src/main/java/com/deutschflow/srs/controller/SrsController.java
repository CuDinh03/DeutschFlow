package com.deutschflow.srs.controller;

import com.deutschflow.srs.dto.ReviewRequest;
import com.deutschflow.srs.dto.ScheduleVocabRequest;
import com.deutschflow.srs.dto.VocabReviewCard;
import com.deutschflow.srs.service.SrsService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST API for Spaced Repetition System (SRS).
 *
 * <h3>Endpoints:</h3>
 * <ul>
 *   <li>GET  /api/srs/due                — Cards due today (max 10)</li>
 *   <li>GET  /api/srs/count              — Count of due cards (for nav badge)</li>
 *   <li>GET  /api/srs/stats              — Summary stats</li>
 *   <li>POST /api/srs/schedule           — Schedule a single vocab item</li>
 *   <li>POST /api/srs/schedule/batch     — Schedule multiple vocab items</li>
 *   <li>POST /api/srs/review             — Record a review result (SM-2 update)</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/srs")
@RequiredArgsConstructor
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
    public ResponseEntity<Map<String, Long>> getDueCount(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(Map.of("dueCount", srsService.countDue(user.getId())));
    }

    /** Stats summary for dashboard */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(srsService.getStats(user.getId()));
    }

    /** Schedule a single vocab item (called after node completion) */
    @PostMapping("/schedule")
    public ResponseEntity<Void> scheduleVocab(
            @AuthenticationPrincipal User user,
            @RequestBody ScheduleVocabRequest req) {
        srsService.scheduleVocab(user.getId(), req);
        return ResponseEntity.ok().build();
    }

    /** Schedule multiple vocab items in batch */
    @PostMapping("/schedule/batch")
    public ResponseEntity<Void> scheduleVocabBatch(
            @AuthenticationPrincipal User user,
            @RequestBody List<ScheduleVocabRequest> items) {
        srsService.scheduleVocabBatch(user.getId(), items);
        return ResponseEntity.ok().build();
    }

    /** Record a review result — updates SM-2 schedule */
    @PostMapping("/review")
    public ResponseEntity<VocabReviewCard> recordReview(
            @AuthenticationPrincipal User user,
            @RequestBody ReviewRequest req) {
        return ResponseEntity.ok(srsService.recordReview(user.getId(), req));
    }
}
