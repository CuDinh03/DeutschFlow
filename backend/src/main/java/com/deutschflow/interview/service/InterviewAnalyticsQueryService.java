package com.deutschflow.interview.service;

import com.deutschflow.interview.dto.InterviewAnalyticsSummaryDto;
import com.deutschflow.interview.repository.InterviewExperimentAssignmentRepository;
import com.deutschflow.interview.repository.InterviewPersonaRepository;
import com.deutschflow.interview.repository.InterviewPhaseResultRepository;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InterviewAnalyticsQueryService {

    private static final List<String> PHASE_ORDER = List.of(
            "INTRO", "ICE_BREAKER", "HARD_SKILLS", "STAR_SOFT", "CLOSING");

    private final AiSpeakingSessionRepository sessionRepository;
    private final InterviewPhaseResultRepository phaseResultRepository;
    private final InterviewExperimentAssignmentRepository experimentRepository;
    private final InterviewPersonaRepository personaRepository;

    public InterviewAnalyticsSummaryDto buildSummary() {
        // ── 1. Session counts (one query) ──────────────────────────────────────
        List<AiSpeakingSession> all = sessionRepository.findBySessionMode("INTERVIEW");
        long total = all.size();
        long completed = all.stream()
                .filter(s -> AiSpeakingSession.SessionStatus.ENDED == s.getStatus())
                .count();
        double completionRate = total == 0 ? 0.0 : completed * 100.0 / total;

        Map<String, Long> byPersona = all.stream()
                .filter(s -> s.getPersona() != null)
                .collect(Collectors.groupingBy(AiSpeakingSession::getPersona, Collectors.counting()));

        // ── 2. Persona → industry map (one query) ─────────────────────────────
        Map<String, String> personaToIndustry = new HashMap<>();
        personaRepository.findAll()
                .forEach(p -> personaToIndustry.put(p.getCode(), p.getIndustry()));

        Map<String, Long> byIndustry = new LinkedHashMap<>();
        for (AiSpeakingSession s : all) {
            String industry = personaToIndustry.getOrDefault(s.getPersona(), "Unknown");
            byIndustry.merge(industry, 1L, Long::sum);
        }

        // ── 3. Phase aggregates (two queries instead of N+1) ──────────────────
        Map<String, Long> phaseSessionCount = new LinkedHashMap<>();
        for (String p : PHASE_ORDER) phaseSessionCount.put(p, 0L);
        phaseResultRepository.aggregateByPhase()
                .forEach(a -> phaseSessionCount.put(a.getPhase(), a.getSessionCount()));

        List<InterviewAnalyticsSummaryDto.PhaseDropOff> dropOff = PHASE_ORDER.stream()
                .map(phase -> new InterviewAnalyticsSummaryDto.PhaseDropOff(
                        phase,
                        phaseSessionCount.getOrDefault(phase, 0L),
                        total == 0 ? 0.0 : phaseSessionCount.getOrDefault(phase, 0L) * 100.0 / total))
                .toList();

        // ── 4. Avg score by industry (join session→industry with score aggregate) ──
        Map<Long, Double> sessionAvgScore = phaseResultRepository.avgScorePerSession()
                .stream()
                .collect(Collectors.toMap(
                        InterviewPhaseResultRepository.SessionScoreAggregate::getSessionId,
                        InterviewPhaseResultRepository.SessionScoreAggregate::getAvgScore));

        Map<Long, String> sessionToIndustry = all.stream()
                .collect(Collectors.toMap(
                        AiSpeakingSession::getId,
                        s -> personaToIndustry.getOrDefault(s.getPersona(), "Unknown")));

        Map<String, List<Double>> scoresByIndustry = new HashMap<>();
        sessionAvgScore.forEach((sessionId, score) -> {
            String industry = sessionToIndustry.getOrDefault(sessionId, "Unknown");
            scoresByIndustry.computeIfAbsent(industry, k -> new ArrayList<>()).add(score);
        });
        Map<String, Double> avgScoreByIndustry = scoresByIndustry.entrySet().stream()
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        e -> e.getValue().stream().mapToDouble(Double::doubleValue).average().orElse(0.0)));

        // ── 5. Variant distribution + avg score by variant (one query) ─────────
        Map<Long, String> sessionToVariant = new HashMap<>();
        experimentRepository.findAll()
                .forEach(e -> sessionToVariant.put(e.getSessionId(), e.getVariantKey()));

        Map<String, Long> variantDist = sessionToVariant.values().stream()
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(v -> v, Collectors.counting()));

        Map<String, List<Double>> scoresByVariant = new HashMap<>();
        sessionAvgScore.forEach((sessionId, score) -> {
            String variant = sessionToVariant.getOrDefault(sessionId, "unknown");
            scoresByVariant.computeIfAbsent(variant, k -> new ArrayList<>()).add(score);
        });
        Map<String, Double> avgScoreByVariant = scoresByVariant.entrySet().stream()
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        e -> e.getValue().stream().mapToDouble(Double::doubleValue).average().orElse(0.0)));

        return new InterviewAnalyticsSummaryDto(
                total, completed, completionRate,
                byIndustry, byPersona,
                avgScoreByIndustry, dropOff,
                variantDist, avgScoreByVariant);
    }
}
