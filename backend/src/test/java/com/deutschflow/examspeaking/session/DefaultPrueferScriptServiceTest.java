package com.deutschflow.examspeaking.session;

import com.deutschflow.examspeaking.api.PrueferScriptService;
import com.deutschflow.examspeaking.api.model.BlueprintPart;
import com.deutschflow.examspeaking.api.model.ExamBlueprint;
import com.deutschflow.examspeaking.api.model.ExamProvider;
import com.deutschflow.examspeaking.api.model.PartFlow;
import com.deutschflow.examspeaking.api.model.TaskArchetype;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Lời dẫn của giám khảo cho telc B1 Teil 3 (Gói D, 17/09/2026): thẻ TASK_SITUATION khai câu lệnh
 * bốn bước của đề thật thì giám khảo đọc đúng câu đó; thẻ Goethe không khai thì câu chung như cũ.
 */
@DisplayName("DefaultPrueferScriptService — Teil 3 telc")
class DefaultPrueferScriptServiceTest {

    private final DefaultPrueferScriptService service = new DefaultPrueferScriptService();
    private static final ExamBlueprint TELC_B1 = new ExamBlueprint(1L, ExamProvider.TELC, "B1", 1, "telc B1", 1200, List.of(), null);

    private static BlueprintPart teil3(String stimulusType) {
        return new BlueprintPart(3, TaskArchetype.PLAN_NEGOTIATE, "Gemeinsam eine Aufgabe lösen", 300,
                PartFlow.DIALOGUE, "PARTNER", stimulusType, 1, 1, 8);
    }

    @Test
    @DisplayName("thẻ telc có instruction bốn bước ⇒ giám khảo đọc tình huống, Zettel và đúng câu lệnh đó")
    void taskSituation_readsFourStepInstruction() {
        String intro = service.line(TELC_B1, teil3("TASK_SITUATION"), PrueferScriptService.Moment.PART_INTRO, Map.of(
                "type", "TASK_SITUATION",
                "situation", "Sie beide planen einen Fahrradausflug.",
                "instruction", "Entscheiden Sie zuerst, was zu tun ist. Einigen Sie sich, wer welche Aufgabe übernimmt.",
                "prompts", List.of("Wohin?", "Wer übernimmt welche Aufgabe?"))).textDe();

        assertThat(intro).contains("Sie beide planen einen Fahrradausflug.")
                .contains("Wohin?")
                .contains("Entscheiden Sie zuerst, was zu tun ist.")
                .contains("wer welche Aufgabe übernimmt")
                .doesNotContain("Machen Sie Vorschläge, reagieren Sie auf die Vorschläge Ihres Partners und einigen Sie sich.");
    }

    @Test
    @DisplayName("HỒI QUY: thẻ Goethe không có instruction ⇒ câu chung như trước")
    void planningCard_withoutInstruction_keepsGenericClosing() {
        String intro = service.line(TELC_B1, teil3("PLANNING_CARD"), PrueferScriptService.Moment.PART_INTRO, Map.of(
                "type", "PLANNING_CARD",
                "situation", "Abschlussfeier",
                "prompts", List.of("Wann?"))).textDe();

        assertThat(intro).contains("Machen Sie Vorschläge, reagieren Sie auf die Vorschläge Ihres Partners und einigen Sie sich.");
    }
}
