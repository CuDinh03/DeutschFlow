package com.deutschflow.speaking.interview;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PhaseProgressionPolicyTest {

    @Test
    @DisplayName("turn 1 of a fresh session stays in INTRO")
    void freshSessionStartsAtIntro() {
        assertThat(PhaseProgressionPolicy.resolve(1, 1, false)).isEqualTo(InterviewPhase.INTRO);
    }

    @Test
    @DisplayName("turn ceiling forces a struggling candidate forward")
    void ceilingForcesWeakCandidateForward() {
        // In HARD_SKILLS at turn 10 (ceiling = STAR_SOFT), goal not met → pushed to STAR_SOFT.
        assertThat(PhaseProgressionPolicy.resolve(InterviewPhase.HARD_SKILLS.number(), 10, false))
                .isEqualTo(InterviewPhase.STAR_SOFT);
    }

    @Test
    @DisplayName("a strong candidate advances earlier than the turn band")
    void goalMetAdvancesStrongCandidateEarly() {
        // In HARD_SKILLS at turn 5 (ceiling still HARD_SKILLS), goal met → advance to STAR_SOFT.
        assertThat(PhaseProgressionPolicy.resolve(InterviewPhase.HARD_SKILLS.number(), 5, true))
                .isEqualTo(InterviewPhase.STAR_SOFT);
    }

    @Test
    @DisplayName("progression never regresses below the current phase")
    void neverRegresses() {
        // Already in STAR_SOFT but turn ceiling would say ICE_BREAKER → stays STAR_SOFT.
        assertThat(PhaseProgressionPolicy.resolve(InterviewPhase.STAR_SOFT.number(), 2, false))
                .isEqualTo(InterviewPhase.STAR_SOFT);
    }

    @Test
    @DisplayName("never advances past CLOSING")
    void cappedAtClosing() {
        assertThat(PhaseProgressionPolicy.resolve(InterviewPhase.CLOSING.number(), 30, true))
                .isEqualTo(InterviewPhase.CLOSING);
    }

    @Test
    @DisplayName("deterministic goal-met requires real signals for HARD_SKILLS")
    void deterministicGoalMetForHardSkills() {
        InterviewSessionState s = InterviewSessionState.initial(1, "x");
        assertThat(PhaseProgressionPolicy.deterministicGoalMet(InterviewPhase.HARD_SKILLS, s)).isFalse();

        var concrete = new InterviewAnswerAnalysis(false, false, false, false, false, true, false);
        s.applyAfterTurn(challengePlan(3), concrete);
        s.applyAfterTurn(challengePlan(4), concrete);

        assertThat(s.getChallengeCount()).isGreaterThanOrEqualTo(2);
        assertThat(s.isConcreteExampleGiven()).isTrue();
        assertThat(PhaseProgressionPolicy.deterministicGoalMet(InterviewPhase.HARD_SKILLS, s)).isTrue();
    }

    @Test
    @DisplayName("short phases never report deterministic goal-met (turn ceiling drives them)")
    void shortPhasesNeverDeterministicGoalMet() {
        InterviewSessionState s = InterviewSessionState.initial(1, "x");
        assertThat(PhaseProgressionPolicy.deterministicGoalMet(InterviewPhase.INTRO, s)).isFalse();
        assertThat(PhaseProgressionPolicy.deterministicGoalMet(InterviewPhase.ICE_BREAKER, s)).isFalse();
    }

    private static InterviewTurnPlan challengePlan(int userTurn) {
        return new InterviewTurnPlan(
                userTurn, InterviewPhase.HARD_SKILLS, InterviewDirectiveType.CHALLENGE_EXAMPLE,
                "challenge", "Frage?", "q" + userTurn, "topic" + userTurn, 15,
                InterviewTurnPlan.DEFAULT_FORBIDDEN, null, false);
    }
}
