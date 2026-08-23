package com.deutschflow.examspeaking.session;

import com.deutschflow.examspeaking.api.model.BlueprintPart;
import com.deutschflow.examspeaking.api.model.PartFlow;
import com.deutschflow.examspeaking.api.model.TaskArchetype;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ExamSessionOrchestratorTest {

    private final ExamSessionOrchestrator o = new ExamSessionOrchestrator();

    private static List<Map<String, Object>> cards(int n, Map<String, Object> template) {
        return java.util.Collections.nCopies(n, template);
    }

    @Test
    void alternatingQaProducesAskAnswerPairsPerRound() {
        BlueprintPart p = new BlueprintPart(2, TaskArchetype.CARD_QA, "Um Informationen bitten", 240, PartFlow.ALTERNATING_QA,
                "PARTNER", "THEME_CARD", 4, 2, 4);
        List<SessionPlan.Step> steps = o.steps(p, cards(4, Map.of("type", "THEME_CARD", "thema", "Essen", "wort", "Brot")));
        assertThat(steps).hasSize(4);
        assertThat(steps.get(0).candidateAction()).isEqualTo("ASK");
        assertThat(steps.get(0).cardIndex()).isEqualTo(0);
        assertThat(steps.get(0).aiAction()).isEqualTo("ANSWER_AND_ASK");
        assertThat(steps.get(1).candidateAction()).isEqualTo("ANSWER");
        assertThat(steps.get(1).cardIndex()).isEqualTo(1);
        assertThat(steps.get(2).cardIndex()).isEqualTo(2);
        assertThat(steps.get(3).cardIndex()).isEqualTo(3);
    }

    @Test
    void examinerLedSelfIntroHasThreeExaminerSteps() {
        BlueprintPart p = new BlueprintPart(1, TaskArchetype.SELF_INTRO, "Sich vorstellen", 180, PartFlow.EXAMINER_LED,
                "NONE", "KEYWORD_CARD", 1, 1, 3);
        List<SessionPlan.Step> steps = o.steps(p, cards(1, Map.of("type", "KEYWORD_CARD", "spell", "Straße", "number", "0176")));
        assertThat(steps).extracting(SessionPlan.Step::aiAction).containsExactly("SPELL_REQUEST", "NUMBER_REQUEST", "THANK");
        assertThat(steps).allMatch(s -> "PRUEFER".equals(s.aiRole()));
    }

    @Test
    void examinerLedWithoutSpellingCardAsksFollowUpsInstead() {
        // telc A2 T1 "Sich vorstellen": không buchstabieren/số → giới thiệu + giám khảo hỏi thêm, kết bằng THANK.
        BlueprintPart p = new BlueprintPart(1, TaskArchetype.SELF_INTRO, "Sich vorstellen", 180, PartFlow.EXAMINER_LED,
                "NONE", "KEYWORD_CARD", 1, 1, 3);
        List<SessionPlan.Step> steps = o.steps(p, cards(1, Map.of("type", "KEYWORD_CARD", "keywords", List.of("Name?", "Hobby?"))));
        assertThat(steps).extracting(SessionPlan.Step::aiAction).containsExactly("FOLLOWUP_QUESTION", "FOLLOWUP_QUESTION", "THANK");
        assertThat(steps).extracting(SessionPlan.Step::candidateAction).containsExactly("SPEAK", "ANSWER", "ANSWER");
    }

    @Test
    void alternatingQaHintsFollowCardType() {
        BlueprintPart person = new BlueprintPart(1, TaskArchetype.CARD_QA, "Fragen zur Person", 180, PartFlow.ALTERNATING_QA,
                "PARTNER", "PERSON_CARD", 8, 4, 8);
        List<SessionPlan.Step> ps = o.steps(person, cards(8, Map.of("type", "PERSON_CARD", "keyword", "Geburtstag?")));
        assertThat(ps).hasSize(8);
        assertThat(ps.get(0).hintVi()).contains("từ khóa");
        assertThat(ps.get(7).cardIndex()).isEqualTo(7);
        BlueprintPart qw = new BlueprintPart(2, TaskArchetype.CARD_QA, "Alltagsgespräch", 240, PartFlow.ALTERNATING_QA,
                "PARTNER", "QUESTION_WORD_CARD", 4, 2, 4);
        List<SessionPlan.Step> qs = o.steps(qw, cards(4, Map.of("type", "QUESTION_WORD_CARD", "thema", "Freizeit", "questionWord", "Wie oft …?")));
        assertThat(qs.get(0).hintVi()).contains("từ hỏi");
    }

    @Test
    void calendarDialogueHintsMentionOwnCalendar() {
        BlueprintPart d = new BlueprintPart(3, TaskArchetype.PLAN_NEGOTIATE, "Planen", 300, PartFlow.DIALOGUE, "PARTNER", "CALENDAR_PAIR", 1, 1, 4);
        List<SessionPlan.Step> ds = o.steps(d, cards(1, Map.of("type", "CALENDAR_PAIR", "candidateCalendar", Map.of(), "partnerCalendar", Map.of())));
        assertThat(ds.get(0).hintVi()).contains("lịch CỦA BẠN");
        assertThat(ds.get(3).aiAction()).isEqualTo("CONCLUDE");
    }

    @Test
    void dialogueEndsWithConclusionAndMonologueWithThanks() {
        BlueprintPart d = new BlueprintPart(3, TaskArchetype.PLAN_NEGOTIATE, "Planen", 300, PartFlow.DIALOGUE, "PARTNER", "PLANNING_CARD", 1, 1, 5);
        List<SessionPlan.Step> ds = o.steps(d, cards(1, Map.of("type", "PLANNING_CARD")));
        assertThat(ds).hasSize(5);
        assertThat(ds.get(4).aiAction()).isEqualTo("CONCLUDE");
        BlueprintPart m = new BlueprintPart(2, TaskArchetype.PRESENT, "Präsentation", 240, PartFlow.MONOLOGUE, "PARTNER", "FOLIEN_DECK", 2, 1, 3);
        List<SessionPlan.Step> ms = o.steps(m, cards(2, Map.of("type", "FOLIEN_DECK")));
        assertThat(ms).hasSize(3);
        assertThat(ms.get(0).candidateAction()).isEqualTo("SPEAK");
        assertThat(ms.get(2).aiAction()).isEqualTo("THANK");
    }

    @Test
    void presentationHasPartnerFeedbackThenExaminerQuestion() {
        BlueprintPart p = new BlueprintPart(2, TaskArchetype.PRESENT, "Ein Thema präsentieren", 240, PartFlow.MONOLOGUE, "NONE", "FOLIEN_DECK", 2, 1, 2);
        // Goethe B1 T2 parts_json nói partnerRole NONE nhưng sau bài có partner hỏi; orchestrator ép ≥3 lượt.
        List<SessionPlan.Step> ps = o.steps(p, cards(2, Map.of("type", "FOLIEN_DECK", "topic", "x")));
        assertThat(ps).hasSize(3);
        assertThat(ps.get(0).candidateAction()).isEqualTo("SPEAK");
        assertThat(ps.get(2).aiAction()).isEqualTo("THANK");
        BlueprintPart withPartner = new BlueprintPart(2, TaskArchetype.PRESENT, "Präsentation", 240, PartFlow.MONOLOGUE, "PARTNER", "FOLIEN_DECK", 2, 1, 3);
        List<SessionPlan.Step> ws = o.steps(withPartner, cards(2, Map.of("type", "FOLIEN_DECK", "topic", "x")));
        assertThat(ws.get(0).aiRole()).isEqualTo("PARTNER");
        assertThat(ws.get(0).aiAction()).isEqualTo("FEEDBACK_AND_QUESTION");
        assertThat(ws.get(1).aiRole()).isEqualTo("PRUEFER");
    }

    @Test
    void feedbackPartHasTwoAiRepliesAfterCandidateFeedback() {
        BlueprintPart p = new BlueprintPart(3, TaskArchetype.FEEDBACK_FOLLOWUP, "Über ein Thema sprechen", 120, PartFlow.FEEDBACK, "PARTNER", "PARTNER_PRESENTATION", 1, 1, 4);
        List<Map<String, Object>> st = cards(1, Map.of("type", "PARTNER_PRESENTATION", "topic", "t", "partnerPresentation", "Mein Thema ist…"));
        List<SessionPlan.Step> steps = o.steps(p, st);
        assertThat(steps).hasSize(2);
        assertThat(steps.get(0).aiRole()).isEqualTo("PARTNER");
        assertThat(steps.get(0).aiAction()).isEqualTo("ANSWER_QUESTION");
        assertThat(steps.get(0).hasSecondAi()).isTrue();
        assertThat(steps.get(0).aiRole2()).isEqualTo("PRUEFER");
        assertThat(steps.get(1).aiAction()).isEqualTo("THANK");
        assertThat(o.preTurn(p, st)).containsEntry("role", "PARTNER").containsEntry("text", "Mein Thema ist…");
    }

    @Test
    void contactCardDialogueEndsWithExaminerQuestion() {
        BlueprintPart p = new BlueprintPart(1, TaskArchetype.TOPIC_EXCHANGE, "Kontaktaufnahme", 210, PartFlow.DIALOGUE, "PARTNER", "CONTACT_CARD", 1, 1, 6);
        List<SessionPlan.Step> steps = o.steps(p, cards(1, Map.of("type", "CONTACT_CARD", "topics", List.of("Name"))));
        assertThat(steps).hasSize(6);
        assertThat(steps.get(4).aiRole()).isEqualTo("PRUEFER");
        assertThat(steps.get(4).aiAction()).isEqualTo("FOLLOWUP_QUESTION");
        assertThat(steps.get(5).aiAction()).isEqualTo("THANK");
        BlueprintPart v = new BlueprintPart(2, TaskArchetype.TOPIC_EXCHANGE, "Gespräch über ein Thema", 330, PartFlow.DIALOGUE, "PARTNER", "TOPIC_GRAPHIC_PAIR", 1, 1, 8);
        List<SessionPlan.Step> vs = o.steps(v, cards(1, Map.of("type", "TOPIC_GRAPHIC_PAIR", "thema", "Reisen")));
        assertThat(vs.get(0).aiAction()).isEqualTo("REPORT_OWN");
        assertThat(vs.get(0).hintVi()).contains("Vorlage");
    }

    @Test
    void effectivePrepIsShortByDefaultAndFullOnRequest() {
        assertThat(ExamSessionService.effectivePrepSec(900, null)).isEqualTo(300);
        assertThat(ExamSessionService.effectivePrepSec(900, "SHORT")).isEqualTo(300);
        assertThat(ExamSessionService.effectivePrepSec(900, "FULL")).isEqualTo(900);
        assertThat(ExamSessionService.effectivePrepSec(120, null)).isEqualTo(120);
    }


    // ── B2 (Đợt 4) ─────────────────────────────────────────────────────────────────────────

    @Test
    void goetheB2VortragLetsPartnerAskFirstThenExaminer() {
        // Quy chế Goethe B2 T1: thí sinh trình bày → bạn thi BẮT BUỘC đặt câu hỏi → giám khảo hỏi.
        BlueprintPart p = new BlueprintPart(1, TaskArchetype.PRESENT, "Vortrag halten", 300, PartFlow.MONOLOGUE,
                "PARTNER", "TOPIC_CHOICE", 2, 1, 4);
        List<SessionPlan.Step> steps = o.steps(p, cards(2, Map.of("type", "TOPIC_CHOICE", "topic", "Homeoffice")));
        assertThat(steps).hasSize(4);
        assertThat(steps.get(0).candidateAction()).isEqualTo("SPEAK");
        assertThat(steps.get(0).aiRole()).isEqualTo("PARTNER");
        assertThat(steps.get(0).aiAction()).isEqualTo("FEEDBACK_AND_QUESTION");
        assertThat(steps.subList(1, 4)).allMatch(s -> "PRUEFER".equals(s.aiRole()));
        assertThat(steps.get(3).aiAction()).isEqualTo("THANK");
    }

    @Test
    void debateCardGetsStandpunktReactSummariseHints() {
        // Goethe B2 T2 „Diskussion führen": Standpunkt austauschen – reagieren – zusammenfassen.
        BlueprintPart p = new BlueprintPart(2, TaskArchetype.DISCUSS, "Diskussion führen", 300, PartFlow.DIALOGUE,
                "PARTNER", "DEBATE_CARD", 1, 1, 4);
        List<SessionPlan.Step> steps = o.steps(p, cards(1, Map.of("type", "DEBATE_CARD",
                "question", "Sollte die Vier-Tage-Woche kommen?", "partnerStance", "dagegen")));
        assertThat(steps).hasSize(4);
        assertThat(steps.get(0).candidateAction()).isEqualTo("SPEAK");
        assertThat(steps.get(0).hintVi()).containsIgnoringCase("quan điểm");
        assertThat(steps.get(0).aiRole()).isEqualTo("PARTNER");
        // Lượt giữa phải là phản biện, không phải "đề xuất tiếp" kiểu lập kế hoạch.
        assertThat(steps.get(1).hintVi()).containsIgnoringCase("phản biện");
        assertThat(steps.get(3).aiAction()).isEqualTo("CONCLUDE");
        assertThat(steps.get(3).hintVi()).contains("dafür oder dagegen");
    }

    @Test
    void debateTextVariantKeepsSameShape() {
        // telc B2 T2: cùng archetype DISCUSS nhưng xuất phát từ một đoạn text.
        BlueprintPart p = new BlueprintPart(2, TaskArchetype.DISCUSS, "Diskussion", 150, PartFlow.DIALOGUE,
                "PARTNER", "DEBATE_TEXT", 1, 1, 3);
        List<SessionPlan.Step> steps = o.steps(p, cards(1, Map.of("type", "DEBATE_TEXT",
                "text", "Immer mehr Betriebe erlauben Hunde am Arbeitsplatz.", "question", "Sollten Hunde erlaubt sein?")));
        assertThat(steps).hasSize(3);
        assertThat(steps.get(0).hintVi()).containsIgnoringCase("quan điểm");
        assertThat(steps.get(2).aiAction()).isEqualTo("CONCLUDE");
    }
}
