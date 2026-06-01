package com.deutschflow.speaking.interview;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class InterviewSpeechSanitizerTest {

    private final InterviewSpeechSanitizer sanitizer = new InterviewSpeechSanitizer();

    @Test
    @DisplayName("keeps a brief natural acknowledgment instead of scrubbing it to 'Verstehe.'")
    void keepsNaturalAcknowledgmentAndQuestion() {
        // Guardrails-not-rails: occasional, genuine acknowledgment is allowed through.
        InterviewTurnPlan plan = plan("Wie genau?");
        String in = "Das ist sehr gut, Herr Schneider. Wie gehen Sie vor?";
        String out = sanitizer.sanitize(in, plan, 3);
        assertThat(out).contains("Wie gehen Sie vor");
        assertThat(out).contains("?");
    }

    @Test
    @DisplayName("still injects the coverage question when the model asked nothing (Phase 1 fallback)")
    void injectsMandatoryQuestionWhenMissing() {
        InterviewTurnPlan plan = plan("Nennen Sie ein konkretes Beispiel.");
        String out = sanitizer.sanitize("Verstehe.", plan, 4);
        assertThat(out).contains("konkretes Beispiel");
    }

    @Test
    @DisplayName("GUARDRAIL kept: orchestration instructions never leak into the reply")
    void stillStripsPromptLeak() {
        InterviewTurnPlan plan = plan("Wie genau?");
        String out = sanitizer.sanitize("Fordern Sie ein konkretes Beispiel von dem Kandidaten.", plan, 3);
        assertThat(out.toLowerCase()).doesNotContain("fordern sie");
        assertThat(out).contains("?");
    }

    @Test
    @DisplayName("composeFromMeta keeps a brief ack rather than collapsing it")
    void composeFromMetaKeepsBriefAck() {
        // Note: the question must not contain a PROMPT_LEAK trigger word (e.g. "Pflichtfrage").
        InterviewTurnPlan plan = plan("Wie haben Sie das konkret umgesetzt?");
        String out = sanitizer.composeFromMeta(
                "Das ist eine sehr umfassende Antwort", "Wie haben Sie das konkret umgesetzt?", plan, 5);
        assertThat(out).contains("umfassende");
        assertThat(out).contains("umgesetzt");
    }

    @Test
    @DisplayName("composeFromMeta trims an over-long ack to the cap instead of nuking it")
    void composeFromMetaTrimsOverlongAck() {
        InterviewTurnPlan plan = plan("Und was war das Ergebnis?");   // ackMaxWords = 8
        String longAck = "wortA wortB wortC wortD wortE wortF wortG wortH wortI wortJ wortK wortL";
        String out = sanitizer.composeFromMeta(longAck, "Und was war das Ergebnis?", plan, 5);
        assertThat(out).doesNotContain("wortL");
        assertThat(out).contains("Ergebnis");
    }

    private static InterviewTurnPlan plan(String question) {
        return new InterviewTurnPlan(
                3, InterviewPhase.HARD_SKILLS, InterviewDirectiveType.CHALLENGE_EXAMPLE,
                "Challenge", question, "q1", "topic", 8,
                InterviewTurnPlan.DEFAULT_FORBIDDEN, null, false);
    }
}
