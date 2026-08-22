package com.deutschflow.examspeaking.session;

import com.deutschflow.examspeaking.api.model.BlueprintPart;
import com.deutschflow.examspeaking.api.model.PartFlow;
import com.deutschflow.examspeaking.api.model.TaskArchetype;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ExamSessionOrchestratorTest {

    private final ExamSessionOrchestrator o = new ExamSessionOrchestrator();

    @Test
    void alternatingQaProducesAskAnswerPairsPerRound() {
        BlueprintPart p = new BlueprintPart(2, TaskArchetype.CARD_QA, "Um Informationen bitten", 240, PartFlow.ALTERNATING_QA,
                "PARTNER", "THEME_CARD", 4, 2, 4);
        List<SessionPlan.Step> steps = o.steps(p, 4);
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
        List<SessionPlan.Step> steps = o.steps(p, 1);
        assertThat(steps).extracting(SessionPlan.Step::aiAction).containsExactly("SPELL_REQUEST", "NUMBER_REQUEST", "THANK");
        assertThat(steps).allMatch(s -> "PRUEFER".equals(s.aiRole()));
    }

    @Test
    void dialogueEndsWithConclusionAndMonologueWithThanks() {
        BlueprintPart d = new BlueprintPart(3, TaskArchetype.PLAN_NEGOTIATE, "Planen", 300, PartFlow.DIALOGUE, "PARTNER", "PLANNING_CARD", 1, 1, 5);
        List<SessionPlan.Step> ds = o.steps(d, 1);
        assertThat(ds).hasSize(5);
        assertThat(ds.get(4).aiAction()).isEqualTo("CONCLUDE");
        BlueprintPart m = new BlueprintPart(2, TaskArchetype.PRESENT, "Präsentation", 240, PartFlow.MONOLOGUE, "PARTNER", "FOLIEN_DECK", 2, 1, 3);
        List<SessionPlan.Step> ms = o.steps(m, 2);
        assertThat(ms).hasSize(3);
        assertThat(ms.get(0).candidateAction()).isEqualTo("SPEAK");
        assertThat(ms.get(2).aiAction()).isEqualTo("THANK");
    }
}
