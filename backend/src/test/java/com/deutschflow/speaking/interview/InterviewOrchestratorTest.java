package com.deutschflow.speaking.interview;

import com.deutschflow.speaking.persona.SpeakingPersona;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class InterviewOrchestratorTest {

    private final InterviewOrchestrator orchestrator =
            new InterviewOrchestrator(new InterviewAnswerAnalyzer(), new PersonaInterviewRegistry());

    @Test
    void hypotheticalAnswerTriggersChallenge() {
        InterviewSessionState state = InterviewSessionState.initial(42, "Hygiene + Labor");
        String answer = "Ich würde immer desinfizieren. Ich würde Handschuhe tragen. Ich würde dokumentieren.";
        InterviewTurnPlan plan = orchestrator.planTurn(
                state, SpeakingPersona.WEBER, "MTA Dermatologie", "1-2Y", 4, answer);
        assertThat(plan.directiveType()).isEqualTo(InterviewDirectiveType.CHALLENGE_EXAMPLE);
    }

    @Test
    void stableSeedFromState() {
        InterviewSessionState state = InterviewSessionState.initial(99, "Fokus A");
        InterviewSessionState again = orchestrator.ensureState(state, SpeakingPersona.LUKAS, "Backend Dev");
        assertThat(again.getSeed()).isEqualTo(99);
    }

    @Test
    void weberQuestionBankNotGenericOnly() {
        InterviewSessionState state = InterviewSessionState.initial(1, "test");
        InterviewTurnPlan plan = orchestrator.planTurn(
                state, SpeakingPersona.WEBER, "MTA Dermatologie", "1-2Y", 8,
                "Ich habe in der Klinik gearbeitet.");
        assertThat(plan.questionId()).startsWith("web_");
    }
}
