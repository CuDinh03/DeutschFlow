package com.deutschflow.interview.service;

import com.deutschflow.interview.dto.InterviewAnalyticsSummaryDto;
import com.deutschflow.interview.repository.InterviewPhaseResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InterviewAnalyticsQueryService {

    private static final List<String> PHASE_ORDER = List.of(
            "INTRO", "ICE_BREAKER", "HARD_SKILLS", "STAR_SOFT", "CLOSING");

    private final InterviewPhaseResultRepository phaseResultRepository;
    private final JdbcTemplate jdbcTemplate;

    public InterviewAnalyticsSummaryDto buildSummary() {
        // ── 1. Session counts via SQL — no full entity load ────────────────────
        Long total = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ai_speaking_sessions WHERE session_mode = 'INTERVIEW'", Long.class);
        if (total == null) total = 0L;

        Long completed = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ai_speaking_sessions WHERE session_mode = 'INTERVIEW' AND status = 'ENDED'", Long.class);
        if (completed == null) completed = 0L;

        double completionRate = total == 0 ? 0.0 : completed * 100.0 / total;

        // byPersona: GROUP BY — no entity load
        Map<String, Long> byPersona = new LinkedHashMap<>();
        jdbcTemplate.queryForList(
                "SELECT persona, COUNT(*) AS cnt FROM ai_speaking_sessions WHERE session_mode = 'INTERVIEW' AND persona IS NOT NULL GROUP BY persona"
        ).forEach(r -> byPersona.put((String) r.get("persona"), ((Number) r.get("cnt")).longValue()));

        // ── 2. Persona → industry map — SELECT only code + industry ───────────
        Map<String, String> personaToIndustry = new HashMap<>();
        jdbcTemplate.queryForList("SELECT code, industry FROM interview_persona")
                .forEach(r -> personaToIndustry.put((String) r.get("code"), (String) r.get("industry")));

        // byIndustry: join persona counts with industry map in Java (both already loaded)
        Map<String, Long> byIndustry = new LinkedHashMap<>();
        byPersona.forEach((persona, cnt) -> {
            String industry = personaToIndustry.getOrDefault(persona, "Unknown");
            byIndustry.merge(industry, cnt, Long::sum);
        });

        // ── 3. Phase aggregates ────────────────────────────────────────────────
        Map<String, Long> phaseSessionCount = new LinkedHashMap<>();
        for (String p : PHASE_ORDER) phaseSessionCount.put(p, 0L);
        phaseResultRepository.aggregateByPhase()
                .forEach(a -> phaseSessionCount.put(a.getPhase(), a.getSessionCount()));

        final long totalFinal = total;
        List<InterviewAnalyticsSummaryDto.PhaseDropOff> dropOff = PHASE_ORDER.stream()
                .map(phase -> new InterviewAnalyticsSummaryDto.PhaseDropOff(
                        phase,
                        phaseSessionCount.getOrDefault(phase, 0L),
                        totalFinal == 0 ? 0.0 : phaseSessionCount.getOrDefault(phase, 0L) * 100.0 / totalFinal))
                .toList();

        // ── 4. Avg score by industry — only load id + persona for cross-ref ────
        Map<Long, Double> sessionAvgScore = phaseResultRepository.avgScorePerSession()
                .stream()
                .collect(Collectors.toMap(
                        InterviewPhaseResultRepository.SessionScoreAggregate::getSessionId,
                        InterviewPhaseResultRepository.SessionScoreAggregate::getAvgScore));

        // Load only id + persona (not full entities) for the industry cross-reference
        Map<Long, String> sessionToIndustry = new HashMap<>();
        jdbcTemplate.queryForList(
                "SELECT id, persona FROM ai_speaking_sessions WHERE session_mode = 'INTERVIEW'"
        ).forEach(r -> {
            Long id = ((Number) r.get("id")).longValue();
            String persona = (String) r.get("persona");
            sessionToIndustry.put(id, personaToIndustry.getOrDefault(persona, "Unknown"));
        });

        Map<String, List<Double>> scoresByIndustry = new HashMap<>();
        sessionAvgScore.forEach((sessionId, score) -> {
            String industry = sessionToIndustry.getOrDefault(sessionId, "Unknown");
            scoresByIndustry.computeIfAbsent(industry, k -> new ArrayList<>()).add(score);
        });
        Map<String, Double> avgScoreByIndustry = scoresByIndustry.entrySet().stream()
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        e -> e.getValue().stream().mapToDouble(Double::doubleValue).average().orElse(0.0)));

        // ── 5. Variant distribution — SELECT only session_id + variant_key ─────
        Map<Long, String> sessionToVariant = new HashMap<>();
        jdbcTemplate.queryForList(
                "SELECT session_id, variant_key FROM interview_experiment_assignment WHERE variant_key IS NOT NULL"
        ).forEach(r -> sessionToVariant.put(((Number) r.get("session_id")).longValue(), (String) r.get("variant_key")));

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
