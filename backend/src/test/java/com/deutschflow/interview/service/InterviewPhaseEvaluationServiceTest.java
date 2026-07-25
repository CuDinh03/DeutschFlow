package com.deutschflow.interview.service;

import com.deutschflow.interview.entity.InterviewPhaseResult;
import com.deutschflow.interview.entity.InterviewTurn;
import com.deutschflow.interview.repository.InterviewPhaseResultRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InterviewPhaseEvaluationServiceTest {

    @Mock
    private InterviewPhaseResultRepository phaseResultRepository;
    @Mock
    private InterviewRubricService rubricService;

    private InterviewPhaseEvaluationService service;

    @BeforeEach
    void setUp() {
        service = new InterviewPhaseEvaluationService(phaseResultRepository, rubricService, new ObjectMapper());
    }

    @Test
    @DisplayName("an unanswered question scores 0, not 3/10 for silence")
    void blankAnswerScoresZero() {
        InterviewPhaseResult saved = evaluate("HARD_SKILLS", List.of(turn("HARD_SKILLS", null, null)));

        assertThat(saved.getScore()).isEqualByComparingTo("0.00");
        assertThat(saved.getWeaknessesJson()).contains("Chưa trả lời câu hỏi (1 lượt)");
    }

    @Test
    @DisplayName("one silent turn no longer props up the phase average")
    void blankAnswerDragsAverageDown() {
        InterviewPhaseResult saved = evaluate("HARD_SKILLS", List.of(
                turn("HARD_SKILLS", "Ich habe das System migriert.", "{}"),   // 5.0
                turn("HARD_SKILLS", null, null)));                            // 0.0, was 3.0

        // (5.0 + 0.0) / 2 — under the old rule this phase read 4.00
        assertThat(saved.getScore()).isEqualByComparingTo("2.50");
    }

    @Test
    @DisplayName("the phantom 'starPresent' key grants no bonus — the analysis record never emits it")
    void phantomStarPresentKeyIsIgnored() {
        InterviewPhaseResult saved = evaluate("STAR_SOFT", List.of(
                turn("STAR_SOFT", "Ich habe eine Situation gelöst.", "{\"starPresent\":true}")));

        // baseline 5.0 — no invented +1.0 from a key the analyzer does not produce
        assertThat(saved.getScore()).isEqualByComparingTo("5.00");
    }

    @Test
    @DisplayName("missingStar costs a point in STAR_SOFT and is reported as a weakness")
    void missingStarPenalisedInStarSoftPhase() {
        InterviewPhaseResult saved = evaluate("STAR_SOFT", List.of(
                turn("STAR_SOFT", "Ich würde das irgendwie machen.", "{\"missingStar\":true}")));

        assertThat(saved.getScore()).isEqualByComparingTo("4.00");
        assertThat(saved.getWeaknessesJson()).contains("Thiếu cấu trúc STAR");
    }

    @Test
    @DisplayName("missingStar outside STAR_SOFT is not judged — the analyzer only sets it in that phase")
    void missingStarIgnoredOutsideStarSoftPhase() {
        InterviewPhaseResult saved = evaluate("HARD_SKILLS", List.of(
                turn("HARD_SKILLS", "Ich habe Microservices gebaut.", "{\"missingStar\":true}")));

        assertThat(saved.getScore()).isEqualByComparingTo("5.00");
        assertThat(saved.getWeaknessesJson()).doesNotContain("STAR");
    }

    @Test
    @DisplayName("a STAR_SOFT turn the analyzer did not flag counts as STAR used")
    void starSoftTurnWithoutFlagIsAStrength() {
        InterviewPhaseResult saved = evaluate("STAR_SOFT", List.of(
                turn("STAR_SOFT", "Situation, Aufgabe, Maßnahme, Ergebnis.", "{\"missingStar\":false}")));

        assertThat(saved.getStrengthsJson()).contains("Sử dụng cấu trúc STAR (1 lượt)");
    }

    @Test
    @DisplayName("a turn with no analysis JSON never counts as a STAR strength")
    void turnWithoutAnalysisIsNotAStarStrength() {
        InterviewPhaseResult saved = evaluate("STAR_SOFT", List.of(
                turn("STAR_SOFT", "Kurze Antwort.", null)));

        assertThat(saved.getStrengthsJson()).doesNotContain("STAR");
    }

    @Test
    @DisplayName("behavioural penalties still apply and the score stays within [0,10]")
    void penaltiesStillApplyAndClamp() {
        InterviewPhaseResult saved = evaluate("HARD_SKILLS", List.of(
                turn("HARD_SKILLS", "Sehr langer Monolog…",
                        "{\"monologue\":true,\"hypotheticalHeavy\":true,\"roleScopeCreep\":true,"
                                + "\"bulletListWithoutConcrete\":true}")));

        // 5.0 − 1.0 − 0.5 − 1.5 − 0.5
        assertThat(saved.getScore()).isEqualByComparingTo("1.50");
    }

    private InterviewPhaseResult evaluate(String phase, List<InterviewTurn> turns) {
        when(phaseResultRepository.findBySessionIdAndPhase(1L, phase)).thenReturn(Optional.empty());
        when(rubricService.findPhaseRubric(anyString(), anyString(), any())).thenReturn(Optional.empty());

        service.evaluatePhase(1L, phase, "IT / Software", "B1", turns);

        ArgumentCaptor<InterviewPhaseResult> captor = ArgumentCaptor.forClass(InterviewPhaseResult.class);
        verify(phaseResultRepository).save(captor.capture());
        return captor.getValue();
    }

    private static InterviewTurn turn(String phase, String userAnswer, String analysisJson) {
        return InterviewTurn.builder()
                .sessionId(1L)
                .turnIndex(0)
                .phase(phase)
                .userAnswer(userAnswer)
                .answerAnalysisJson(analysisJson)
                .build();
    }
}
