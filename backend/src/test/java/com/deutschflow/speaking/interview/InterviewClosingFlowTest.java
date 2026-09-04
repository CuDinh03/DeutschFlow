package com.deutschflow.speaking.interview;

import com.deutschflow.speaking.persona.SpeakingPersona;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Đợt F (10/08) — vá cụm hội thoại L2/L3/L4: greeting không bị nuốt, closing trả lời trước farewell. */
class InterviewClosingFlowTest {

    private final InterviewOrchestrator orchestrator =
            new InterviewOrchestrator(new InterviewAnswerAnalyzer(), new PersonaInterviewRegistry());
    private final InterviewSpeechSanitizer sanitizer = new InterviewSpeechSanitizer();

    private static InterviewTurnPlan plan(InterviewDirectiveType directive, String mandatory) {
        return new InterviewTurnPlan(8, InterviewPhase.CLOSING, directive, "", mandatory,
                "q", "closing", 15, InterviewTurnPlan.DEFAULT_FORBIDDEN, null, false);
    }

    // ── L2: câu hỏi INTRO hợp lệ không còn bị coi là prompt-leak ──────────

    @Test
    @DisplayName("L2: greeting chứa 'Bitte stellen Sie sich kurz vor' GIỮ NGUYÊN lời tự giới thiệu persona")
    void introQuestionIsNotTreatedAsLeak() {
        InterviewTurnPlan greet = new InterviewTurnPlan(1, InterviewPhase.INTRO,
                InterviewDirectiveType.STANDARD, "",
                "Bitte stellen Sie sich kurz vor: Werdegang, relevante Erfahrung.", "intro_self", "intro",
                15, InterviewTurnPlan.DEFAULT_FORBIDDEN, null, false);
        String in = "Willkommen! Ich bin Lukas, Senior Tech Lead in Berlin. Bitte stellen Sie sich kurz vor: Werdegang, relevante Erfahrung?";

        String out = sanitizer.sanitize(in, greet, 1);

        assertThat(out).contains("Ich bin Lukas");
        assertThat(out).doesNotStartWith("Danke.");
    }

    @Test
    @DisplayName("L2: chỉ dẫn nội bộ thật ('Fordern Sie…') vẫn bị chặn như cũ")
    void realLeakStillBlocked() {
        InterviewTurnPlan p = plan(InterviewDirectiveType.STANDARD, "Wie genau?");
        String out = sanitizer.sanitize("Fordern Sie ein konkretes Beispiel von dem Kandidaten.", p, 3);
        assertThat(out.toLowerCase()).doesNotContain("fordern sie");
    }

    // ── L4: farewell tự nhiên không bị đè bản canned ──────────────────────

    @Test
    @DisplayName("L4: lượt FAREWELL — lời chào tự nhiên (không có '?') được giữ, không bị thay bằng canned + 'Verstehe.'")
    void naturalFarewellKept() {
        InterviewTurnPlan p = plan(InterviewDirectiveType.CLOSING_FAREWELL,
                "Vielen Dank für das Gespräch und Ihr Interesse an Kellner. Wir werden uns melden. Auf Wiedersehen!");
        String natural = "Vielen Dank für das Gespräch. Wir melden uns in den nächsten Tagen bei Ihnen. Auf Wiedersehen!";

        String out = sanitizer.sanitize(natural, p, 8);

        assertThat(out).isEqualTo(natural);
    }

    @Test
    @DisplayName("L4 vẫn giữ coverage cũ: lượt thường model quên hỏi → câu bank được chèn (kể cả câu mệnh lệnh không '?')")
    void coverageFallbackStillWorksForNormalTurns() {
        InterviewTurnPlan p = new InterviewTurnPlan(4, InterviewPhase.HARD_SKILLS,
                InterviewDirectiveType.STANDARD, "", "Nennen Sie ein konkretes Beispiel.", "q", "t",
                15, InterviewTurnPlan.DEFAULT_FORBIDDEN, null, false);
        String out = sanitizer.sanitize("Verstehe.", p, 4);
        assertThat(out).contains("konkretes Beispiel");
    }

    @Test
    @DisplayName("F2: greeting hỏi kiểu MỆNH LỆNH (không '?') vẫn được tính là đã hỏi — giữ trọn lời giới thiệu")
    void imperativeQuestionCountsAsAsked() {
        InterviewTurnPlan greet = new InterviewTurnPlan(1, InterviewPhase.INTRO,
                InterviewDirectiveType.STANDARD, "",
                "Bitte stellen Sie sich kurz vor: Werdegang und Erfahrung.", "intro_self", "intro",
                15, InterviewTurnPlan.DEFAULT_FORBIDDEN, null, false);
        String in = "Hallo, ich bin Lukas, Senior Tech Lead. Erzählen Sie mir kurz von Ihrem Werdegang und Ihrem nächsten Karriereschritt.";

        String out = sanitizer.sanitize(in, greet, 1);

        assertThat(out).contains("Ich bin Lukas".replace("Ich","ich")).contains("Erzählen Sie mir");
        assertThat(out).doesNotStartWith("Danke.");
    }

    // ── L4: thứ tự directive ở CLOSING ────────────────────────────────────

    @Test
    @DisplayName("L4: ứng viên hỏi ở lượt sau CLOSING_ASK → CLOSING_ANSWER thắng farewell (câu hỏi không bị lơ)")
    void candidateQuestionsBeatFarewell() {
        InterviewSessionState state = InterviewSessionState.initial(1, "f");
        state.applyAfterTurn(plan(InterviewDirectiveType.CLOSING_ASK, "Haben Sie noch Fragen an uns?"),
                new InterviewAnswerAnalysis(false, false, false, false, false, false, false));
        state.setPhase(InterviewPhase.CLOSING.number());

        InterviewTurnPlan next = orchestrator.planTurn(state, SpeakingPersona.NIKLAS, "Kellner",
                "1-2Y", 24, "Ich habe noch eine Frage: Wie geht es nach diesem Gespräch weiter?", "control", "A2");

        assertThat(next.directiveType()).isEqualTo(InterviewDirectiveType.CLOSING_ANSWER);
    }

    @Test
    @DisplayName("L4: sau khi ĐÃ farewell, lượt kế không quay lại 'Haben Sie noch Fragen?' — chào ngắn lần nữa")
    void noAskAfterFarewell() {
        InterviewSessionState state = InterviewSessionState.initial(1, "f");
        state.applyAfterTurn(plan(InterviewDirectiveType.CLOSING_FAREWELL, "Auf Wiedersehen!"),
                new InterviewAnswerAnalysis(false, false, false, false, false, false, false));
        state.setPhase(InterviewPhase.CLOSING.number());

        InterviewTurnPlan next = orchestrator.planTurn(state, SpeakingPersona.NIKLAS, "Kellner",
                "1-2Y", 26, "Vielen Dank, auf Wiedersehen!", "control", "A2");

        assertThat(next.directiveType()).isEqualTo(InterviewDirectiveType.CLOSING_FAREWELL);
        assertThat(next.mandatoryQuestionDe().toLowerCase()).doesNotContain("fragen an uns");
    }
}
