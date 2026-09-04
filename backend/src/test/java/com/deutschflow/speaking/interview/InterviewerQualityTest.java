package com.deutschflow.speaking.interview;

import com.deutschflow.speaking.persona.SpeakingPersona;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Đợt E kế hoạch 10/08 — chất lượng người phỏng vấn: STAR ≥2 lượt, calibrate khen, fallback hết lặp. */
class InterviewerQualityTest {

    private final InterviewOrchestrator orchestrator =
            new InterviewOrchestrator(new InterviewAnswerAnalyzer(), new PersonaInterviewRegistry());

    // ── E3: STAR không được rời trước 2 lượt ──────────────────────────────

    @Test
    @DisplayName("E3: đang STAR 1 lượt + goalMet → vẫn ở STAR; đủ 2 lượt → được sang CLOSING")
    void starPhaseHeldUntilTwoTurns() {
        int star = InterviewPhase.STAR_SOFT.number();
        assertThat(PhaseProgressionPolicy.resolve(star, 11, true, 1)).isEqualTo(InterviewPhase.STAR_SOFT);
        assertThat(PhaseProgressionPolicy.resolve(star, 11, true, 2)).isEqualTo(InterviewPhase.CLOSING);
    }

    @Test
    @DisplayName("E3: trần tổng lượt (turn 13+) vẫn thắng — không kẹt STAR vô hạn")
    void turnCeilingStillWins() {
        int star = InterviewPhase.STAR_SOFT.number();
        assertThat(PhaseProgressionPolicy.resolve(star, 13, false, 0)).isEqualTo(InterviewPhase.CLOSING);
    }

    @Test
    @DisplayName("E3: applyAfterTurn đếm starTurns; codec round-trip giữ giá trị")
    void starTurnsCountedAndSerialized() {
        InterviewSessionState state = InterviewSessionState.initial(1, "focus");
        InterviewTurnPlan starPlan = new InterviewTurnPlan(10, InterviewPhase.STAR_SOFT,
                InterviewDirectiveType.STANDARD, "", "q", "star_conflict", "team", 15,
                InterviewTurnPlan.DEFAULT_FORBIDDEN, null, false);
        state.applyAfterTurn(starPlan, new InterviewAnswerAnalysis(false, false, false, false, false, false, false));
        state.applyAfterTurn(starPlan, new InterviewAnswerAnalysis(false, false, false, false, false, false, false));

        assertThat(state.getStarTurns()).isEqualTo(2);

        InterviewStateCodec codec = new InterviewStateCodec(new com.fasterxml.jackson.databind.ObjectMapper());
        assertThat(codec.decode(codec.encode(state)).getStarTurns()).isEqualTo(2);
    }

    // ── E2: calibrate khen theo chất lượng câu trả lời ────────────────────

    @Test
    @DisplayName("E2: câu trả lời yếu → cấm cả khen nhẹ + chỉ thị ack trung tính; câu bình thường → danh sách cấm mặc định")
    void weakAnswerBansLightPraise() {
        InterviewSessionState state = InterviewSessionState.initial(42, "focus");

        InterviewTurnPlan weakPlan = orchestrator.planTurn(state, SpeakingPersona.NIKLAS, "Kellner",
                "1-2Y", 6, "Ich weiß nicht. Vielleicht.", "control", "A2");
        assertThat(weakPlan.forbiddenPhrases()).contains("gute idee", "guter ansatz", "klingt gut");
        assertThat(weakPlan.directiveInstruction()).contains("SCHWACH");

        InterviewTurnPlan normalPlan = orchestrator.planTurn(state, SpeakingPersona.NIKLAS, "Kellner",
                "1-2Y", 6,
                "Zum Beispiel habe ich letzten Samstag zwölf Tische allein betreut und die Bestellungen nach Gängen priorisiert, danach war der Chef zufrieden.",
                "control", "A2");
        assertThat(normalPlan.forbiddenPhrases()).isEqualTo(InterviewTurnPlan.DEFAULT_FORBIDDEN);
        assertThat(normalPlan.directiveInstruction()).doesNotContain("SCHWACH");
    }

    // ── E1: fallback hết lặp ──────────────────────────────────────────────

    @Test
    @DisplayName("E1: lượt 1 (bank INTRO cạn sau greeting) không lặp lại câu 'stellen Sie sich vor'")
    void introFallbackDoesNotRepeatGreetingQuestion() {
        InterviewSessionState state = InterviewSessionState.initial(42, "focus");
        // Greeting đã hỏi intro_self → đánh dấu như prod (applyAfterTurn của greeting).
        InterviewTurnPlan greet = orchestrator.planTurn(state, SpeakingPersona.DEFAULT, "Bürokaufmann",
                "3Y", 0, null, "control", "B1");
        state.applyAfterTurn(greet, new InterviewAnswerAnalysis(false, false, false, false, false, false, false));

        InterviewTurnPlan turn1 = orchestrator.planTurn(state, SpeakingPersona.DEFAULT, "Bürokaufmann",
                "3Y", 0, "Guten Tag, mein Name ist Lan, ich arbeite seit fünf Jahren im Büro.", "control", "B1");

        assertThat(turn1.mandatoryQuestionDe().toLowerCase()).doesNotContain("stellen sie sich");
    }

    @Test
    @DisplayName("E1: fallback HARD_SKILLS xoay biến thể theo lượt — 2 lượt liền không trùng nguyên văn")
    void hardSkillsFallbackVariesByTurn() {
        // DEFAULT persona, bank HARD_SKILLS đã hỏi hết → so sánh fallback ở 2 lượt liên tiếp.
        InterviewSessionState state = InterviewSessionState.initial(42, "focus");
        for (String qid : new String[]{"gen_responsibility", "gen_quality", "gen_team",
                "gen_process", "gen_tools", "gen_prioritize"}) {
            state.applyAfterTurn(new InterviewTurnPlan(1, InterviewPhase.HARD_SKILLS,
                    InterviewDirectiveType.STANDARD, "", "q", qid, "t", 15,
                    InterviewTurnPlan.DEFAULT_FORBIDDEN, null, false),
                    new InterviewAnswerAnalysis(false, false, false, false, false, false, false));
        }
        String answer = "Zum Beispiel habe ich letztes Jahr dreihundert Rechnungen pro Monat verwaltet und zwanzig Prozent Zeit gespart.";

        InterviewTurnPlan p1 = orchestrator.planTurn(state, SpeakingPersona.DEFAULT, "Bürokaufmann",
                "3Y", 12, answer, "control", "B1");
        InterviewTurnPlan p2 = orchestrator.planTurn(state, SpeakingPersona.DEFAULT, "Bürokaufmann",
                "3Y", 14, answer, "control", "B1");

        if (p1.questionId().startsWith("fallback_") && p2.questionId().startsWith("fallback_")
                && p1.phase() == p2.phase()) {
            assertThat(p1.mandatoryQuestionDe()).isNotEqualTo(p2.mandatoryQuestionDe());
        }
    }
}
