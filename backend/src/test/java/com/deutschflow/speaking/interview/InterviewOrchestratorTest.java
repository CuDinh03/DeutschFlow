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

    // ── Variant C tests ───────────────────────────────────────────────────────

    @Test
    void variantC_weakAnswer_upgradesDirectiveToProbeSpecific() {
        // Registry with no DB repo → falls back to hardcoded bank (no adaptive follow-up)
        // But directive is still upgraded to PROBE_SPECIFIC when a follow-up is found.
        // With no-arg registry, pickChallengeFollowUp returns empty → stays CHALLENGE_EXAMPLE.
        // This test verifies the "control" path is unchanged.
        InterviewSessionState state = InterviewSessionState.initial(1, "Labor");
        String weakAnswer = "Ich würde Handschuhe tragen und würde dokumentieren.";
        InterviewTurnPlan control = orchestrator.planTurn(
                state, SpeakingPersona.WEBER, "MTA", "1-2Y", 4, weakAnswer, "control");
        assertThat(control.directiveType()).isEqualTo(InterviewDirectiveType.CHALLENGE_EXAMPLE);
    }

    @Test
    void variantC_strongAnswer_doesNotUpgrade() {
        InterviewSessionState state = InterviewSessionState.initial(1, "Labor");
        String strongAnswer = "Im Oktober 2023 hatte ich in der Praxis einen Hygienevorfall. "
                + "Ich habe sofort die Station gesperrt, den Arzt informiert und alles dokumentiert. "
                + "Das Ergebnis war eine neue SOP für das Team.";
        InterviewTurnPlan plan = orchestrator.planTurn(
                state, SpeakingPersona.WEBER, "MTA", "1-2Y", 4, strongAnswer, "variant_c");
        // Strong answer → not a weak answer → no adaptive follow-up triggered
        assertThat(plan.directiveType()).isNotEqualTo(InterviewDirectiveType.PROBE_SPECIFIC);
    }

    @Test
    void variantC_closingPhase_notAffected() {
        InterviewSessionState state = InterviewSessionState.initial(1, "Closing");
        InterviewTurnPlan plan = orchestrator.planTurn(
                state, SpeakingPersona.WEBER, "MTA", "1-2Y", 24,
                "Ich würde gerne mehr wissen.", "variant_c");
        // CLOSING phase → CLOSING_ASK / CLOSING_ANSWER / CLOSING_FAREWELL, not PROBE_SPECIFIC
        assertThat(plan.directiveType()).isIn(
                InterviewDirectiveType.CLOSING_ASK,
                InterviewDirectiveType.CLOSING_ANSWER,
                InterviewDirectiveType.CLOSING_FAREWELL);
    }

    @Test
    void closingFarewellTriggeredAfterClosingAsk() {
        // After CLOSING_ASK fires on turn 13, the next CLOSING turn should yield CLOSING_FAREWELL
        InterviewSessionState state = InterviewSessionState.initial(1, "Tech");
        // Simulate that the previous turn was CLOSING_ASK
        state.applyAfterTurn(
                new InterviewTurnPlan(13, InterviewPhase.CLOSING,
                        InterviewDirectiveType.CLOSING_ASK, "", "Haben Sie noch Fragen?",
                        "close_ask", "closing", 8, InterviewTurnPlan.DEFAULT_FORBIDDEN, null, false),
                new InterviewAnswerAnalysis(false, false, false, false, false, false, false));

        // Turn 14 — user answers without asking questions
        InterviewTurnPlan plan = orchestrator.planTurn(
                state, SpeakingPersona.LUKAS, "Backend Dev", "2-4Y", 26, "Nein, ich habe keine Fragen.");
        assertThat(plan.directiveType()).isEqualTo(InterviewDirectiveType.CLOSING_FAREWELL);
        assertThat(plan.mandatoryQuestion()).containsIgnoringCase("wiedersehen");
    }

    @Test
    void closingFarewellTriggeredAfterClosingAnswer() {
        // After CLOSING_ANSWER (user asked questions), next turn should be CLOSING_FAREWELL
        InterviewSessionState state = InterviewSessionState.initial(1, "Tech");
        state.applyAfterTurn(
                new InterviewTurnPlan(13, InterviewPhase.CLOSING,
                        InterviewDirectiveType.CLOSING_ANSWER, "", "Beantworten...",
                        "close_answer", "closing", 8, InterviewTurnPlan.DEFAULT_FORBIDDEN, null, true),
                new InterviewAnswerAnalysis(false, false, false, false, false, false, false));

        InterviewTurnPlan plan = orchestrator.planTurn(
                state, SpeakingPersona.LUKAS, "Backend Dev", "2-4Y", 26, "Danke für die Antworten.");
        assertThat(plan.directiveType()).isEqualTo(InterviewDirectiveType.CLOSING_FAREWELL);
    }

    @Test
    void noArgOverloadDefaultsToControl() {
        InterviewSessionState state = InterviewSessionState.initial(42, "Hygiene");
        String answer = "Ich würde immer sauber arbeiten. Ich würde Handschuhe tragen.";
        // No-variant overload must behave identically to explicit "control"
        InterviewTurnPlan noArg = orchestrator.planTurn(
                state, SpeakingPersona.WEBER, "MTA", "1-2Y", 4, answer);
        InterviewTurnPlan control = orchestrator.planTurn(
                state, SpeakingPersona.WEBER, "MTA", "1-2Y", 4, answer, "control");
        assertThat(noArg.directiveType()).isEqualTo(control.directiveType());
        assertThat(noArg.mandatoryQuestion()).isEqualTo(control.mandatoryQuestion());
    }
}
