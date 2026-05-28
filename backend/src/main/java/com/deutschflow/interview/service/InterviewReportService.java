package com.deutschflow.interview.service;

import com.deutschflow.interview.dto.InterviewReportDto;
import com.deutschflow.interview.entity.InterviewPhaseResult;
import com.deutschflow.interview.entity.InterviewTurn;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
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

        BigDecimal overallScore = computeOverallScore(phaseResults);
        String verdict = deriveVerdict(overallScore, turns);
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
        if (score == null) return "FAIL";
        double s = score.doubleValue();
        long completedTurns = turns.stream().filter(t -> t.getUserAnswer() != null).count();
        if (completedTurns < 3) return "FAIL";
        if (s >= 7.0) return "PASS";
        if (s >= 5.0) return "CONDITIONAL";
        return "FAIL";
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
