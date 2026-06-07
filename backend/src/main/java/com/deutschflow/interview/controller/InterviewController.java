package com.deutschflow.interview.controller;

import com.deutschflow.interview.dto.InterviewAnalyticsSummaryDto;
import com.deutschflow.interview.dto.InterviewPersonaDto;
import com.deutschflow.interview.dto.InterviewReportDto;
import com.deutschflow.interview.dto.InterviewTurnDto;
import com.deutschflow.interview.entity.InterviewExperimentAssignment;
import com.deutschflow.interview.service.*;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Interview domain REST API.
 * Separate from the speaking session API to cleanly bound the interview product line.
 */
@RestController
@RequestMapping("/api/interviews")
@RequiredArgsConstructor
@Slf4j
public class InterviewController {

    private final PersonaRegistryService personaRegistryService;
    private final InterviewTurnPersistenceService turnPersistenceService;
    private final InterviewPhaseEvaluationService phaseEvalService;
    private final InterviewReportService reportService;
    private final InterviewExperimentService experimentService;
    private final InterviewAnalyticsQueryService analyticsQueryService;
    private final AiSpeakingSessionRepository sessionRepository;

    /** List all active interview-capable personas. */
    @GetMapping("/personas")
    public ResponseEntity<List<InterviewPersonaDto>> listPersonas() {
        List<InterviewPersonaDto> personas = personaRegistryService.listActive()
                .stream()
                .map(InterviewPersonaDto::from)
                .toList();
        return ResponseEntity.ok(personas);
    }

    /**
     * Load a session only if it belongs to the authenticated user. Returns 404 (not 403) whether
     * the session is missing or owned by someone else, so the endpoint can't be used to enumerate
     * other users' interview sessions by id (IDOR).
     */
    private AiSpeakingSession requireOwnedSession(Long sessionId, User user) {
        return sessionRepository.findById(sessionId)
                .filter(s -> user != null && s.getUserId() != null && s.getUserId().equals(user.getId()))
                .orElseThrow(() -> new NotFoundException("Session not found"));
    }

    /** Get all persisted turns for an interview session. */
    @GetMapping("/{sessionId}/turns")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<InterviewTurnDto>> getTurns(@PathVariable Long sessionId,
                                                           @AuthenticationPrincipal User user) {
        requireOwnedSession(sessionId, user);
        List<InterviewTurnDto> turns = turnPersistenceService.getTurnsForSession(sessionId)
                .stream()
                .map(InterviewTurnDto::from)
                .toList();
        return ResponseEntity.ok(turns);
    }

    /** Get per-phase evaluation results for a session. */
    @GetMapping("/{sessionId}/phase-results")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getPhaseResults(@PathVariable Long sessionId,
                                             @AuthenticationPrincipal User user) {
        requireOwnedSession(sessionId, user);
        return ResponseEntity.ok(phaseEvalService.getPhaseResults(sessionId));
    }

    /** Get the structured deterministic report for a completed session. */
    @GetMapping("/{sessionId}/report")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<InterviewReportDto> getReport(@PathVariable Long sessionId,
                                                        @AuthenticationPrincipal User user) {
        AiSpeakingSession session = requireOwnedSession(sessionId, user);
        InterviewReportDto report = reportService.buildStructuredReport(session);
        return ResponseEntity.ok(report);
    }

    /** Get A/B experiment assignments for a session. */
    @GetMapping("/{sessionId}/experiments")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<InterviewExperimentAssignment>> getExperiments(@PathVariable Long sessionId,
                                                                              @AuthenticationPrincipal User user) {
        requireOwnedSession(sessionId, user);
        return ResponseEntity.ok(experimentService.getAssignmentsForSession(sessionId));
    }

    /** Aggregate KPI summary for the admin interview analytics dashboard. */
    @GetMapping("/analytics")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<InterviewAnalyticsSummaryDto> getAnalytics() {
        return ResponseEntity.ok(analyticsQueryService.buildSummary());
    }
}
