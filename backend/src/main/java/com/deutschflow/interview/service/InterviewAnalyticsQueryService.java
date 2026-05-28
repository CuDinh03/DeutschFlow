package com.deutschflow.interview.service;

import com.deutschflow.interview.dto.InterviewAnalyticsSummaryDto;
import com.deutschflow.interview.entity.InterviewPhaseResult;
import com.deutschflow.interview.repository.InterviewExperimentAssignmentRepository;
import com.deutschflow.interview.repository.InterviewPersonaRepository;
import com.deutschflow.interview.repository.InterviewPhaseResultRepository;
import com.deutschflow.interview.repository.InterviewTurnRepository;
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
        List<AiSpeakingSession> all = sessionRepository.findBySessionMode("INTERVIEW");
        long total = all.size();

        long completed = all.stream()
                .filter(s -> AiSpeakingSession.SessionStatus.ENDED == s.getStatus())
                .count();
        double completionRate = total == 0 ? 0.0 : (double) completed / total * 100.0;

        Map<String, Long> byPersona = all.stream()
                .filter(s -> s.getPersona() != null)
                .collect(Collectors.groupingBy(AiSpeakingSession::getPersona, Collectors.counting()));

        Map<String, Long> byIndustry = resolveIndustry(all);

        Map<String, Double> avgScoreByIndustry = computeAvgScoreByIndustry(all);

        List<InterviewAnalyticsSummaryDto.PhaseDropOff> dropOff = computePhaseDropOff(all, total);

        Map<String, Long> variantDist = experimentRepository.findAll().stream()
                .filter(e -> e.getVariantKey() != null)
                .collect(Collectors.groupingBy(e -> e.getVariantKey(), Collectors.counting()));

        Map<String, Double> avgScoreByVariant = computeAvgScoreByVariant(all);

        return new InterviewAnalyticsSummaryDto(
                total, completed, completionRate,
                byIndustry, byPersona,
                avgScoreByIndustry, dropOff,
                variantDist, avgScoreByVariant);
    }

    private Map<String, Long> resolveIndustry(List<AiSpeakingSession> sessions) {
        Map<String, String> personaToIndustry = new HashMap<>();
        personaRepository.findAllByActiveTrue().forEach(p -> personaToIndustry.put(p.getCode(), p.getIndustry()));

        Map<String, Long> result = new LinkedHashMap<>();
        for (AiSpeakingSession s : sessions) {
            String industry = personaToIndustry.getOrDefault(s.getPersona(), "Unknown");
            result.merge(industry, 1L, Long::sum);
        }
        return result;
    }

    private Map<String, Double> computeAvgScoreByIndustry(List<AiSpeakingSession> sessions) {
        Map<String, String> personaToIndustry = new HashMap<>();
        personaRepository.findAllByActiveTrue().forEach(p -> personaToIndustry.put(p.getCode(), p.getIndustry()));

        Map<String, List<Double>> scoresByIndustry = new HashMap<>();
        for (AiSpeakingSession s : sessions) {
            String industry = personaToIndustry.getOrDefault(s.getPersona(), "Unknown");
            List<InterviewPhaseResult> results = phaseResultRepository.findBySessionIdOrderByPhaseAsc(s.getId());
            for (InterviewPhaseResult pr : results) {
                if (pr.getScore() != null) {
                    scoresByIndustry.computeIfAbsent(industry, k -> new ArrayList<>())
                            .add(pr.getScore().doubleValue());
                }
            }
        }
        return scoresByIndustry.entrySet().stream()
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        e -> e.getValue().stream().mapToDouble(Double::doubleValue).average().orElse(0.0)));
    }

    private List<InterviewAnalyticsSummaryDto.PhaseDropOff> computePhaseDropOff(
            List<AiSpeakingSession> sessions, long total) {
        if (total == 0) return List.of();

        Map<String, Long> phaseReached = new LinkedHashMap<>();
        for (String phase : PHASE_ORDER) phaseReached.put(phase, 0L);

        for (AiSpeakingSession s : sessions) {
            List<InterviewPhaseResult> results = phaseResultRepository.findBySessionIdOrderByPhaseAsc(s.getId());
            for (InterviewPhaseResult pr : results) {
                phaseReached.merge(pr.getPhase(), 1L, Long::sum);
            }
        }

        return PHASE_ORDER.stream()
                .map(phase -> new InterviewAnalyticsSummaryDto.PhaseDropOff(
                        phase,
                        phaseReached.getOrDefault(phase, 0L),
                        phaseReached.getOrDefault(phase, 0L) * 100.0 / total))
                .toList();
    }

    private Map<String, Double> computeAvgScoreByVariant(List<AiSpeakingSession> sessions) {
        Map<Long, String> sessionToVariant = new HashMap<>();
        experimentRepository.findAll().forEach(e -> sessionToVariant.put(e.getSessionId(), e.getVariantKey()));

        Map<String, List<Double>> scores = new HashMap<>();
        for (AiSpeakingSession s : sessions) {
            String variant = sessionToVariant.getOrDefault(s.getId(), "unknown");
            List<InterviewPhaseResult> results = phaseResultRepository.findBySessionIdOrderByPhaseAsc(s.getId());
            for (InterviewPhaseResult pr : results) {
                if (pr.getScore() != null) {
                    scores.computeIfAbsent(variant, k -> new ArrayList<>())
                            .add(pr.getScore().doubleValue());
                }
            }
        }
        return scores.entrySet().stream()
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        e -> e.getValue().stream().mapToDouble(Double::doubleValue).average().orElse(0.0)));
    }
}
