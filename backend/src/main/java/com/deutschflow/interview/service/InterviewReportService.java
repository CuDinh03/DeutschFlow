package com.deutschflow.interview.service;

import com.deutschflow.interview.dto.InterviewReportDto;
import com.deutschflow.interview.entity.InterviewPhaseResult;
import com.deutschflow.interview.entity.InterviewTurn;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Builds a structured {@link InterviewReportDto} from phase results and turn data.
 * This is the deterministic layer of the final report; the LLM-based qualitative
 * evaluation lives in {@link com.deutschflow.speaking.service.InterviewEvaluationService}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InterviewReportService {

    private final InterviewPhaseEvaluationService phaseEvalService;
    private final InterviewTurnPersistenceService turnPersistenceService;
    private final ObjectMapper objectMapper;

    public InterviewReportDto buildStructuredReport(AiSpeakingSession session) {
        List<InterviewTurn> turns = turnPersistenceService.getTurnsForSession(session.getId());
        List<InterviewPhaseResult> phaseResults = phaseEvalService.getPhaseResults(session.getId());

        // Phase 3: the level-aware LLM evaluation is the PRIMARY score/verdict; the deterministic
        // phase scoring becomes an anti-sycophancy bound. LLM-primary, not cookie-cutter scoring.
        BigDecimal deterministicScore = computeOverallScore(phaseResults);
        LlmEvalSummary llm = parseLlmEval(session.getInterviewReportJson());
        BigDecimal overallScore = applyAntiSycophancyBound(
                chooseBaseScore(llm.score(), deterministicScore), turns);
        String verdict = reconcileVerdict(llm.verdict(), overallScore, turns);
        String readinessLevel = deriveReadinessLevel(session.getExperienceLevel(), overallScore);

        List<String> strongAreas = phaseResults.stream()
                .filter(p -> p.getScore() != null && p.getScore().compareTo(BigDecimal.valueOf(7)) >= 0)
                .map(p -> "Phase " + p.getPhase() + " (điểm: " + p.getScore() + ")")
                .toList();

        List<String> criticalGaps = phaseResults.stream()
                .filter(p -> p.getScore() != null && p.getScore().compareTo(BigDecimal.valueOf(5)) < 0)
                .map(p -> "Phase " + p.getPhase() + " (điểm: " + p.getScore() + ")")
                .toList();

        List<String> recommendedDrills = deriveRecommendedDrills(phaseResults, turns);

        return new InterviewReportDto(
                session.getId(),
                session.getInterviewPosition(),
                session.getExperienceLevel(),
                overallScore,
                verdict,
                readinessLevel,
                strongAreas,
                criticalGaps,
                recommendedDrills,
                phaseResults.stream().map(this::toPhaseDto).toList()
        );
    }

    // ── Phase 3: LLM-primary scoring (level-aware) with a deterministic anti-sycophancy bound ──

    private record LlmEvalSummary(BigDecimal score, String verdict) {
        static LlmEvalSummary empty() {
            return new LlmEvalSummary(null, null);
        }
    }

    /** Parses overall_score + verdict from the persisted LLM evaluation JSON (tolerant of any shape). */
    private LlmEvalSummary parseLlmEval(String reportJson) {
        if (reportJson == null || reportJson.isBlank()) {
            return LlmEvalSummary.empty();
        }
        try {
            JsonNode root = objectMapper.readTree(reportJson);
            return new LlmEvalSummary(parseLeadingNumber(text(root, "overall_score")), text(root, "verdict"));
        } catch (Exception e) {
            log.debug("LLM eval JSON unparseable, using deterministic score: {}", e.getMessage());
            return LlmEvalSummary.empty();
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v == null || v.isNull() ? null : v.asText(null);
    }

    /** Extracts the leading number from strings like "7.5/10", "7,5" or "8 / 10". */
    static BigDecimal parseLeadingNumber(String s) {
        if (s == null) {
            return null;
        }
        var m = java.util.regex.Pattern.compile("(\\d+(?:[.,]\\d+)?)").matcher(s);
        if (!m.find()) {
            return null;
        }
        try {
            return new BigDecimal(m.group(1).replace(',', '.')).setScale(2, RoundingMode.HALF_UP);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * Chooses the base score: the LLM score when it is a sane value on the expected [0,10] scale,
     * otherwise the deterministic phase score. Guards against an LLM emitting an off-scale number
     * (e.g. "85" or "85/100") that would otherwise corrupt the verdict/readiness derivation.
     */
    static BigDecimal chooseBaseScore(BigDecimal llmScore, BigDecimal deterministicScore) {
        if (llmScore == null) {
            return deterministicScore;
        }
        if (llmScore.compareTo(BigDecimal.ZERO) < 0 || llmScore.compareTo(BigDecimal.TEN) > 0) {
            log.debug("LLM overall_score {} outside [0,10]; using deterministic score {}",
                    llmScore, deterministicScore);
            return deterministicScore;
        }
        return llmScore;
    }

    /** LLM verdict is primary, but too few substantive turns can never PASS regardless of LLM optimism. */
    private String reconcileVerdict(String llmVerdict, BigDecimal score, List<InterviewTurn> turns) {
        long completedTurns = turns.stream().filter(t -> t.getUserAnswer() != null).count();
        if (completedTurns < 3) {
            return "NOT_PASS";
        }
        if (llmVerdict != null && isKnownVerdict(llmVerdict)) {
            return llmVerdict.trim().toUpperCase(Locale.ROOT);
        }
        return deriveVerdict(score, turns);
    }

    private static boolean isKnownVerdict(String v) {
        String u = v.trim().toUpperCase(Locale.ROOT);
        return u.equals("PASS") || u.equals("CONDITIONAL_PASS") || u.equals("NOT_PASS");
    }

    /** A high score cannot be certified with zero concrete evidence anywhere in the transcript. */
    private BigDecimal applyAntiSycophancyBound(BigDecimal score, List<InterviewTurn> turns) {
        if (score == null) {
            return BigDecimal.ZERO;
        }
        boolean anyConcrete = turns.stream().anyMatch(t -> containsAnalysisFlag(t, "concreteExample"));
        BigDecimal cap = BigDecimal.valueOf(6.5);
        return (!anyConcrete && score.compareTo(cap) > 0) ? cap : score;
    }

    private BigDecimal computeOverallScore(List<InterviewPhaseResult> phaseResults) {
        if (phaseResults.isEmpty()) return BigDecimal.ZERO;
        double sum = phaseResults.stream()
                .filter(p -> p.getScore() != null)
                .mapToDouble(p -> p.getScore().doubleValue())
                .sum();
        long count = phaseResults.stream().filter(p -> p.getScore() != null).count();
        if (count == 0) return BigDecimal.ZERO;
        return BigDecimal.valueOf(sum / count).setScale(2, RoundingMode.HALF_UP);
    }

    private String deriveVerdict(BigDecimal score, List<InterviewTurn> turns) {
        if (score == null) return "NOT_PASS";
        double s = score.doubleValue();
        long completedTurns = turns.stream().filter(t -> t.getUserAnswer() != null).count();
        if (completedTurns < 3) return "NOT_PASS";
        if (s >= 7.0) return "PASS";
        if (s >= 5.0) return "CONDITIONAL_PASS";
        return "NOT_PASS";
    }

    private String deriveReadinessLevel(String experienceLevel, BigDecimal score) {
        if (score == null) return "NEEDS_PREPARATION";
        double s = score.doubleValue();
        if (s >= 8.0) return "INTERVIEW_READY";
        if (s >= 6.0) return "NEARLY_READY";
        if (s >= 4.0) return "NEEDS_PRACTICE";
        return "NEEDS_PREPARATION";
    }

    private List<String> deriveRecommendedDrills(List<InterviewPhaseResult> phaseResults,
                                                   List<InterviewTurn> turns) {
        java.util.List<String> drills = new java.util.ArrayList<>();
        boolean hasWeakHardSkills = phaseResults.stream()
                .anyMatch(p -> "HARD_SKILLS".equals(p.getPhase())
                        && p.getScore() != null
                        && p.getScore().compareTo(BigDecimal.valueOf(5)) < 0);
        if (hasWeakHardSkills) drills.add("Luyện tập kỹ năng chuyên môn với câu hỏi cụ thể theo ngành");

        long hypotheticalTurns = turns.stream()
                .filter(t -> containsAnalysisFlag(t, "hypotheticalHeavy"))
                .count();
        if (hypotheticalTurns > 2) drills.add("Luyện trả lời cụ thể: thay câu trả lời giả thuyết bằng ví dụ có thật");

        long missingStar = turns.stream()
                .filter(t -> "STAR_SOFT".equals(t.getPhase()) && !containsAnalysisFlag(t, "starPresent"))
                .count();
        if (missingStar > 1) drills.add("Luyện cấu trúc STAR (Situation → Task → Action → Result) cho câu hỏi behavioral");

        long monologueTurns = turns.stream()
                .filter(t -> containsAnalysisFlag(t, "monologue"))
                .count();
        if (monologueTurns > 1) drills.add("Luyện kiểm soát độ dài câu trả lời: mục tiêu 90-120 giây mỗi câu");

        if (drills.isEmpty()) drills.add("Tiếp tục thực hành phỏng vấn để duy trì phong độ");
        return drills;
    }

    private boolean containsAnalysisFlag(InterviewTurn turn, String flag) {
        if (turn.getAnswerAnalysisJson() == null) return false;
        try {
            Map<?, ?> map = objectMapper.readValue(turn.getAnswerAnalysisJson(), Map.class);
            return Boolean.TRUE.equals(map.get(flag));
        } catch (Exception e) {
            return false;
        }
    }

    private InterviewReportDto.PhaseResultDto toPhaseDto(InterviewPhaseResult result) {
        List<String> strengths = parseJsonList(result.getStrengthsJson());
        List<String> weaknesses = parseJsonList(result.getWeaknessesJson());
        return new InterviewReportDto.PhaseResultDto(result.getPhase(), result.getScore(), strengths, weaknesses);
    }

    @SuppressWarnings("unchecked")
    private List<String> parseJsonList(String json) {
        if (json == null) return List.of();
        try {
            return objectMapper.readValue(json, List.class);
        } catch (JsonProcessingException e) {
            return List.of();
        }
    }
}
