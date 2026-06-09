package com.deutschflow.teacher.controller;

import com.deutschflow.teacher.dto.TeacherSessionDto;
import com.deutschflow.teacher.service.TeacherSessionService;
import com.deutschflow.user.entity.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/teacher-sessions")
@RequiredArgsConstructor
public class TeacherSessionController {

    private final TeacherSessionService sessionService;

    // ── Student: book ─────────────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<TeacherSessionDto> book(
            @AuthenticationPrincipal User student,
            @RequestBody @Valid BookRequest req) {
        return ResponseEntity.ok(sessionService.bookSession(
                student, req.teacherProfileId(), req.title(), req.notes(),
                req.scheduledAt(), req.durationMinutes()));
    }

    // ── Student: my sessions ──────────────────────────────────────────────────

    @GetMapping("/my")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Page<TeacherSessionDto>> mySessions(
            @AuthenticationPrincipal User student,
            @RequestParam(defaultValue = "0") int page) {
        return ResponseEntity.ok(sessionService.getStudentSessions(student.getId(), page));
    }

    // ── Teacher: incoming sessions ────────────────────────────────────────────

    @GetMapping("/teacher")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<Page<TeacherSessionDto>> teacherSessions(
            @AuthenticationPrincipal User actor,
            @RequestParam Long profileId,
            @RequestParam(defaultValue = "0") int page) {
        return ResponseEntity.ok(sessionService.getTeacherSessions(actor, profileId, page));
    }

    // ── Teacher: confirm / complete / cancel ──────────────────────────────────

    @PatchMapping("/{id}/status")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<TeacherSessionDto> updateStatus(
            @AuthenticationPrincipal User actor,
            @PathVariable Long id,
            @RequestBody UpdateStatusRequest req) {
        return ResponseEntity.ok(sessionService.updateStatus(actor, id, req.status(), req.teacherNotes()));
    }

    // ── Student: submit review ────────────────────────────────────────────────

    @PostMapping("/{id}/review")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<TeacherSessionDto> submitReview(
            @AuthenticationPrincipal User student,
            @PathVariable Long id,
            @RequestBody @Valid ReviewRequest req) {
        return ResponseEntity.ok(sessionService.submitReview(student, id, req.rating(), req.reviewText()));
    }

    // ── Teacher: earnings ─────────────────────────────────────────────────────

    @GetMapping("/earnings")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<Map<String, Object>> earnings(
            @AuthenticationPrincipal User actor,
            @RequestParam Long profileId) {
        return ResponseEntity.ok(sessionService.getEarningsSummary(actor, profileId));
    }

    // ── Admin: pending payouts ────────────────────────────────────────────────

    @GetMapping("/admin/pending-payouts")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<TeacherSessionDto>> pendingPayouts() {
        return ResponseEntity.ok(sessionService.getPendingPayouts());
    }

    @PostMapping("/admin/mark-paid")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> markPaid(@RequestBody List<Long> sessionIds) {
        sessionService.markPayoutProcessed(sessionIds);
        return ResponseEntity.ok().build();
    }

    // ── Request records ───────────────────────────────────────────────────────

    public record BookRequest(
            @NotNull Long teacherProfileId,
            @NotBlank String title,
            String notes,
            @NotNull LocalDateTime scheduledAt,
            @Min(30) @Max(120) int durationMinutes
    ) {}

    public record UpdateStatusRequest(
            @NotBlank String status,
            String teacherNotes
    ) {}

    public record ReviewRequest(
            @Min(1) @Max(5) short rating,
            String reviewText
    ) {}
}
