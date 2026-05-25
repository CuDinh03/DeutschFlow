package com.deutschflow.speaking.interview;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class InterviewSpeechSanitizerTest {

    private final InterviewSpeechSanitizer sanitizer = new InterviewSpeechSanitizer();

    @Test
    void stripsPraisePhrases() {
        InterviewTurnPlan plan = plan("Wie genau?");
        String in = "Das ist sehr gut, Herr Schneider. Wie gehen Sie vor?";
        String out = sanitizer.sanitize(in, plan, 3);
        assertThat(out.toLowerCase()).doesNotContain("sehr gut");
        assertThat(out).contains("?");
    }

    @Test
    void injectsMandatoryQuestionWhenMissing() {
        InterviewTurnPlan plan = plan("Nennen Sie ein konkretes Beispiel.");
        String out = sanitizer.sanitize("Verstehe.", plan, 4);
        assertThat(out).contains("konkretes Beispiel");
    }

    @Test
    void composeFromMetaUsesShortAck() {
        InterviewTurnPlan plan = plan("Pflichtfrage?");
        String out = sanitizer.composeFromMeta(
                "Das ist eine sehr umfassende Antwort", "Pflichtfrage?", plan, 5);
        assertThat(out).doesNotContain("umfassende");
        assertThat(out).contains("Pflichtfrage?");
    }

    private static InterviewTurnPlan plan(String question) {
        return new InterviewTurnPlan(
                3, InterviewPhase.HARD_SKILLS, InterviewDirectiveType.CHALLENGE_EXAMPLE,
                "Challenge", question, "q1", "topic", 8,
                InterviewTurnPlan.DEFAULT_FORBIDDEN, null, false);
    }
}
