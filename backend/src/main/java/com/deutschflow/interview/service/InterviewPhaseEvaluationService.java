package com.deutschflow.interview.service;

import com.deutschflow.interview.entity.InterviewPhaseResult;
import com.deutschflow.interview.entity.InterviewTurn;
import com.deutschflow.interview.repository.InterviewPhaseResultRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;

/**
 * Computes per-phase scores from deterministic rules applied to turn data.
 * LLM-based qualitative evaluation happens in {@link InterviewReportService}; this service
 * handles the rule-based layer (section 8.1 of the spec).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InterviewPhaseEvaluationService {

    /** Matches {@code InterviewPhase.STAR_SOFT.name()} — the only phase where STAR structure is judged. */
    private static final String STAR_SOFT_PHASE = "STAR_SOFT";

    private final InterviewPhaseResultRepository phaseResultRepository;
    private final InterviewRubricService rubricService;
    private final ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void evaluatePhase(Long sessionId, String phase, String industry, String cefrLevel,
                              List<InterviewTurn> phaseTurns) {
        if (phaseResultRepository.findBySessionIdAndPhase(sessionId, phase).isPresent()) {
            return;
        }
        try {
            BigDecimal score = computeRuleBasedScore(phaseTurns);
            var rubricOpt = rubricService.findPhaseRubric(industry, phase, cefrLevel);
            // Provenance only — which rubric version was in force for this phase. It is NOT an input
            // to `score`: weights map rubric criteria (technical_depth, empathy…) while the rule-based
            // layer measures behavioural flags (concreteExample, monologue…), so there is no per-criterion
            // number to weight. Rubric criteria/weights influence judgement through the prompt
            // (see InterviewPromptBuilder → ScoringPromptLayer) and the LLM score, which is primary.
            String weightsJson = rubricOpt.map(r -> r.getWeightJson()).orElse(null);
            Long rubricId = rubricOpt.map(r -> r.getId()).orElse(null);

            List<String> strengths = deriveStrengths(phaseTurns);
            List<String> weaknesses = deriveWeaknesses(phaseTurns);

            InterviewPhaseResult result = InterviewPhaseResult.builder()
                    .sessionId(sessionId)
                    .phase(phase)
                    .score(score)
                    .rubricTemplateId(rubricId)
                    .weightsJson(weightsJson)
                    .strengthsJson(toJson(strengths))
                    .weaknessesJson(toJson(weaknesses))
                    .build();
            phaseResultRepository.save(result);
        } catch (Exception e) {
            log.warn("Failed to evaluate phase {} for session {}: {}", phase, sessionId, e.getMessage());
        }
    }

    public List<InterviewPhaseResult> getPhaseResults(Long sessionId) {
        return phaseResultRepository.findBySessionIdOrderByPhaseAsc(sessionId);
    }

    private BigDecimal computeRuleBasedScore(List<InterviewTurn> turns) {
        if (turns.isEmpty()) return BigDecimal.ZERO;
        double total = 0.0;
        for (InterviewTurn turn : turns) {
            total += scoreTurn(turn);
        }
        double avg = total / turns.size();
        return BigDecimal.valueOf(avg).setScale(2, RoundingMode.HALF_UP);
    }

    private double scoreTurn(InterviewTurn turn) {
        // A question the candidate never answered is not evidence of a 3/10 performance — it is
        // no performance at all. The previous 3.0 handed out 30% of the phase for silence.
        if (turn.getUserAnswer() == null || turn.getUserAnswer().isBlank()) return 0.0;
        String analysis = turn.getAnswerAnalysisJson();
        if (analysis == null) return 5.0;
        try {
            Map<?, ?> map = objectMapper.readValue(analysis, Map.class);
            double score = 5.0;
            if (Boolean.TRUE.equals(map.get("concreteExample"))) score += 1.5;
            if (isMissingStar(turn, map))                        score -= 1.0;
            if (Boolean.TRUE.equals(map.get("monologue")))        score -= 1.0;
            if (Boolean.TRUE.equals(map.get("hypotheticalHeavy")))score -= 0.5;
            if (Boolean.TRUE.equals(map.get("bulletListWithoutConcrete"))) score -= 0.5;
            if (Boolean.TRUE.equals(map.get("roleScopeCreep")))   score -= 1.5;
            return Math.max(0.0, Math.min(10.0, score));
        } catch (Exception e) {
            return 5.0;
        }
    }

    /**
     * STAR structure only carries meaning in the STAR_SOFT phase: {@link
     * com.deutschflow.speaking.interview.InterviewAnswerAnalyzer} computes {@code missingStar} as
     * {@code phase == STAR_SOFT && no STAR hint}, so it is false by construction everywhere else.
     *
     * <p>The rule this replaces read a {@code starPresent} key that the analysis record never emits
     * (its field is {@code missingStar}), so the intended +1.0 STAR bonus was dead for every turn.
     * It is restored as a penalty rather than a bonus on {@code !missingStar}: the degraded path in
     * {@code TurnSideEffectsService} persists an all-false analysis when the analyzer is skipped, and
     * a bonus keyed on {@code !missingStar} would silently reward those turns for evidence nobody saw.
     */
    private boolean isMissingStar(InterviewTurn turn, Map<?, ?> analysis) {
        return STAR_SOFT_PHASE.equals(turn.getPhase()) && Boolean.TRUE.equals(analysis.get("missingStar"));
    }

    private List<String> deriveStrengths(List<InterviewTurn> turns) {
        long concreteCount = turns.stream()
                .filter(t -> containsFlag(t.getAnswerAnalysisJson(), "concreteExample"))
                .count();
        // STAR is judged only in STAR_SOFT, and only its ABSENCE is measured (see isMissingStar).
        // A STAR_SOFT turn the analyzer did not flag is the closest evidence of STAR being used.
        long starCount = turns.stream()
                .filter(t -> STAR_SOFT_PHASE.equals(t.getPhase()))
                .filter(t -> t.getAnswerAnalysisJson() != null)
                .filter(t -> !containsFlag(t.getAnswerAnalysisJson(), "missingStar"))
                .count();
        java.util.List<String> strengths = new java.util.ArrayList<>();
        if (concreteCount > 0) strengths.add("Trả lời cụ thể với ví dụ thực tế (" + concreteCount + " lượt)");
        if (starCount > 0)     strengths.add("Sử dụng cấu trúc STAR (" + starCount + " lượt)");
        return strengths;
    }

    private List<String> deriveWeaknesses(List<InterviewTurn> turns) {
        long monologueCount  = turns.stream().filter(t -> containsFlag(t.getAnswerAnalysisJson(), "monologue")).count();
        long hypothetical    = turns.stream().filter(t -> containsFlag(t.getAnswerAnalysisJson(), "hypotheticalHeavy")).count();
        long scopeCreep      = turns.stream().filter(t -> containsFlag(t.getAnswerAnalysisJson(), "roleScopeCreep")).count();
        long missingStar     = turns.stream()
                .filter(t -> STAR_SOFT_PHASE.equals(t.getPhase()))
                .filter(t -> containsFlag(t.getAnswerAnalysisJson(), "missingStar"))
                .count();
        long unanswered      = turns.stream()
                .filter(t -> t.getUserAnswer() == null || t.getUserAnswer().isBlank())
                .count();
        java.util.List<String> weaknesses = new java.util.ArrayList<>();
        if (monologueCount > 0) weaknesses.add("Câu trả lời quá dài / monologue (" + monologueCount + " lượt)");
        if (hypothetical > 0)   weaknesses.add("Trả lời giả thuyết, thiếu ví dụ cụ thể (" + hypothetical + " lượt)");
        if (scopeCreep > 0)     weaknesses.add("Vượt ra ngoài phạm vi vai trò được hỏi (" + scopeCreep + " lượt)");
        if (missingStar > 0)    weaknesses.add("Thiếu cấu trúc STAR khi kể tình huống (" + missingStar + " lượt)");
        if (unanswered > 0)     weaknesses.add("Chưa trả lời câu hỏi (" + unanswered + " lượt)");
        return weaknesses;
    }

    private boolean containsFlag(String analysisJson, String flag) {
        if (analysisJson == null) return false;
        try {
            Map<?, ?> map = objectMapper.readValue(analysisJson, Map.class);
            return Boolean.TRUE.equals(map.get(flag));
        } catch (Exception e) {
            return false;
        }
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }
}
