package com.deutschflow.grammar.controller;

import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.grammar.dto.GrammarDraftDto;
import com.deutschflow.grammar.dto.GrammarExerciseDto;
import com.deutschflow.grammar.dto.GrammarGeneratedExerciseDto;
import com.deutschflow.grammar.dto.GrammarPendingReviewDto;
import com.deutschflow.grammar.dto.GrammarSubmitResultDto;
import com.deutschflow.grammar.dto.GrammarTopicDto;
import com.deutschflow.grammar.service.GrammarSyllabusService;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Grammar Syllabus API
 *
 * Student: GET topics, GET exercises, POST submit answer
 * Teacher: POST generate exercises, GET my drafts, POST submit for review
 * Admin:   GET pending, POST approve/reject
 */
@RestController
@RequestMapping("/api/grammar/syllabus")
@RequiredArgsConstructor
public class GrammarSyllabusController {

    private static final long GRAMMAR_GEN_ESTIMATED_TOKENS = 2_000L;

    private final GrammarSyllabusService service;
    private final QuotaService quotaService;
    private final OrgPoolGuard orgPoolGuard;

    // ─── Helper ──────────────────────────────────────────────────
    private long userId(User principal) {
        return principal.getId();
    }

    // ─── Student: Topics ─────────────────────────────────────────

    @GetMapping("/topics")
    public ResponseEntity<List<GrammarTopicDto>> getTopics(
            @RequestParam(defaultValue = "A1") String cefrLevel,
            @AuthenticationPrincipal User principal) {
        return ResponseEntity.ok(service.getTopicsWithProgress(cefrLevel, userId(principal)));
    }

    // ─── Student: Exercises ──────────────────────────────────────

    @GetMapping("/topics/{topicId}/exercises")
    public ResponseEntity<List<GrammarExerciseDto>> getExercises(
            @PathVariable long topicId,
            @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(service.getApprovedExercises(topicId, limit));
    }

    @PostMapping("/exercises/{exerciseId}/submit")
    public ResponseEntity<GrammarSubmitResultDto> submitAnswer(
            @PathVariable long exerciseId,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User principal) {
        String answer = body.getOrDefault("answer", "");
        return ResponseEntity.ok(service.submitAnswer(userId(principal), exerciseId, answer));
    }

    // ─── Teacher: AI Generate ────────────────────────────────────

    @PostMapping("/topics/{topicId}/generate")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<List<GrammarGeneratedExerciseDto>> generateExercises(
            @PathVariable long topicId,
            @RequestBody Map<String, Integer> body,
            @AuthenticationPrincipal User principal) {
        long uid = userId(principal);
        quotaService.assertAllowed(uid, Instant.now(), GRAMMAR_GEN_ESTIMATED_TOKENS);
        orgPoolGuard.assertOrgPoolAvailable(uid, GRAMMAR_GEN_ESTIMATED_TOKENS);
        int count = body.getOrDefault("count", 5);
        return ResponseEntity.ok(service.generateExercises(topicId, Math.min(count, 20), uid));
    }

    @GetMapping("/exercises/my-drafts")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<List<GrammarDraftDto>> getMyDrafts(
            @AuthenticationPrincipal User principal) {
        return ResponseEntity.ok(service.getMyDrafts(userId(principal)));
    }

    @PostMapping("/exercises/{exerciseId}/submit-review")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<Void> submitForReview(
            @PathVariable long exerciseId,
            @AuthenticationPrincipal User principal) {
        service.submitForReview(exerciseId, userId(principal));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/topics/{topicId}/submit-all-review")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<Void> submitAllForReview(
            @PathVariable long topicId,
            @AuthenticationPrincipal User principal) {
        service.submitAllDraftsForReview(topicId, userId(principal));
        return ResponseEntity.ok().build();
    }

    // ─── Admin: Review ───────────────────────────────────────────

    @GetMapping("/admin/pending")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<GrammarPendingReviewDto>> getPendingReview() {
        return ResponseEntity.ok(service.getPendingReview());
    }

    @PostMapping("/admin/exercises/{exerciseId}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> approveExercise(
            @PathVariable long exerciseId,
            @AuthenticationPrincipal User principal) {
        service.approveExercise(exerciseId, userId(principal));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/admin/exercises/{exerciseId}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> rejectExercise(
            @PathVariable long exerciseId,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User principal) {
        service.rejectExercise(exerciseId, userId(principal), body.getOrDefault("reason", ""));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/admin/exercises/bulk-approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> bulkApprove(
            @RequestBody Map<String, List<Long>> body,
            @AuthenticationPrincipal User principal) {
        service.bulkApprove(body.getOrDefault("ids", List.of()), userId(principal));
        return ResponseEntity.ok().build();
    }
}
