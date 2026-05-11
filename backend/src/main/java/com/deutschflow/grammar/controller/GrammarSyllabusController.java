package com.deutschflow.grammar.controller;

import com.deutschflow.grammar.service.GrammarSyllabusService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

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

    private final GrammarSyllabusService service;

    // ─── Helper ──────────────────────────────────────────────────
    private long userId(UserDetails principal) {
        // UserDetails.getUsername() returns the user ID as string in DeutschFlow
        try { return Long.parseLong(principal.getUsername()); }
        catch (Exception e) { throw new RuntimeException("Cannot resolve user ID"); }
    }

    // ─── Student: Topics ─────────────────────────────────────────

    @GetMapping("/topics")
    public ResponseEntity<List<Map<String, Object>>> getTopics(
            @RequestParam(defaultValue = "A1") String cefrLevel,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(service.getTopicsWithProgress(cefrLevel, userId(principal)));
    }

    // ─── Student: Exercises ──────────────────────────────────────

    @GetMapping("/topics/{topicId}/exercises")
    public ResponseEntity<List<Map<String, Object>>> getExercises(
            @PathVariable long topicId,
            @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(service.getApprovedExercises(topicId, limit));
    }

    @PostMapping("/exercises/{exerciseId}/submit")
    public ResponseEntity<Map<String, Object>> submitAnswer(
            @PathVariable long exerciseId,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserDetails principal) {
        String answer = body.getOrDefault("answer", "");
        return ResponseEntity.ok(service.submitAnswer(userId(principal), exerciseId, answer));
    }

    // ─── Teacher: AI Generate ────────────────────────────────────

    @PostMapping("/topics/{topicId}/generate")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> generateExercises(
            @PathVariable long topicId,
            @RequestBody Map<String, Integer> body,
            @AuthenticationPrincipal UserDetails principal) {
        int count = body.getOrDefault("count", 5);
        return ResponseEntity.ok(service.generateExercises(topicId, Math.min(count, 20), userId(principal)));
    }

    @GetMapping("/exercises/my-drafts")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> getMyDrafts(
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(service.getMyDrafts(userId(principal)));
    }

    @PostMapping("/exercises/{exerciseId}/submit-review")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<Void> submitForReview(
            @PathVariable long exerciseId,
            @AuthenticationPrincipal UserDetails principal) {
        service.submitForReview(exerciseId, userId(principal));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/topics/{topicId}/submit-all-review")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<Void> submitAllForReview(
            @PathVariable long topicId,
            @AuthenticationPrincipal UserDetails principal) {
        service.submitAllDraftsForReview(topicId, userId(principal));
        return ResponseEntity.ok().build();
    }

    // ─── Admin: Review ───────────────────────────────────────────

    @GetMapping("/admin/pending")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> getPendingReview() {
        return ResponseEntity.ok(service.getPendingReview());
    }

    @PostMapping("/admin/exercises/{exerciseId}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> approveExercise(
            @PathVariable long exerciseId,
            @AuthenticationPrincipal UserDetails principal) {
        service.approveExercise(exerciseId, userId(principal));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/admin/exercises/{exerciseId}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> rejectExercise(
            @PathVariable long exerciseId,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserDetails principal) {
        service.rejectExercise(exerciseId, userId(principal), body.getOrDefault("reason", ""));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/admin/exercises/bulk-approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> bulkApprove(
            @RequestBody Map<String, List<Long>> body,
            @AuthenticationPrincipal UserDetails principal) {
        service.bulkApprove(body.getOrDefault("ids", List.of()), userId(principal));
        return ResponseEntity.ok().build();
    }
}
