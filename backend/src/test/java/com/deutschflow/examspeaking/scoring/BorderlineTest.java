package com.deutschflow.examspeaking.scoring;

import com.deutschflow.examspeaking.api.model.Ergebnisbogen;
import com.deutschflow.examspeaking.api.model.ExamProvider;
import com.deutschflow.examspeaking.api.model.RubricDefinition;
import com.deutschflow.examspeaking.api.model.RubricRef;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * F-17 (audit 31/08): khoảng [totalLow, totalHigh] của các pass vắt qua ngưỡng đỗ → cờ {@code borderline}
 * + ghi chú structured; {@code passed} vẫn chốt theo điểm tâm (thống kê/golden cần một kết luận).
 */
class BorderlineTest {

    private static final RubricRef REF = new RubricRef(ExamProvider.GOETHE, "B1", 1);

    private static RubricDefinition goetheB1() {
        Map<String, Double> fr = Map.of("A", 1.0, "B", 0.75, "C", 0.5, "D", 0.25, "E", 0.0);
        return new RubricDefinition(ExamProvider.GOETHE, RubricDefinition.BandScale.A_E, fr, 100, 60.0, null, null, null,
                true, true, List.of(new RubricDefinition.RubricPart(1,
                        List.of(new RubricDefinition.RubricCriterion("ERFUELLUNG", "", 100, Map.of())), List.of())),
                List.of(), null, null);
    }

    private static RubricDefinition telcB1() {
        return new RubricDefinition(ExamProvider.TELC, RubricDefinition.BandScale.A_D, Map.of(), 75, null, 45.0, null, null,
                false, true, List.of(new RubricDefinition.RubricPart(1,
                        List.of(new RubricDefinition.RubricCriterion("AUFGABENBEWAELTIGUNG", "", 75, Map.of("A", 75.0, "B", 60.0, "C", 40.0, "D", 0.0))), List.of())),
                List.of(), null, null);
    }

    private static Ergebnisbogen assemble(RubricDefinition rubric, double total, Double low, Double high) {
        List<Ergebnisbogen.CriterionResult> crit = List.of(new Ergebnisbogen.CriterionResult(
                "ERFUELLUNG", "", "B", total, rubric.officialMax(), true, "medium", List.of()));
        List<Ergebnisbogen.PartResult> parts = List.of(new Ergebnisbogen.PartResult(1, crit, total, rubric.officialMax(), false, null));
        return RubricScorer.Totals.assemble(new RubricRef(rubric.scheme(), "B1", 1), rubric, parts, List.of(), List.of(),
                new ArrayList<>(), new ArrayList<>(), 2, low, high);
    }

    @Test
    @DisplayName("khoảng vắt qua ngưỡng module (Goethe B1 ≥60): 58–64 → borderline, passed theo tâm 61")
    void straddlesModuleThreshold() {
        Ergebnisbogen e = assemble(goetheB1(), 61, 58.0, 64.0);
        assertThat(e.borderline()).isTrue();
        assertThat(e.passed()).isTrue();
        assertThat(e.noteMsgs()).anyMatch(m -> "borderline".equals(m.code())
                && "58".equals(m.params().get("low")) && "64".equals(m.params().get("high")) && "60".equals(m.params().get("min")));
        assertThat(e.notes()).anyMatch(n -> n.contains("vắt qua ngưỡng"));
    }

    @Test
    @DisplayName("cả khoảng cùng một phía ngưỡng → không borderline (đỗ rõ / trượt rõ)")
    void clearPassOrFail() {
        assertThat(assemble(goetheB1(), 70, 66.0, 74.0).borderline()).isFalse();
        assertThat(assemble(goetheB1(), 50, 45.0, 55.0).borderline()).isFalse();
        assertThat(assemble(goetheB1(), 50, 45.0, 55.0).passed()).isFalse();
    }

    @Test
    @DisplayName("một pass (low == high) không bao giờ borderline; ngưỡng nói riêng telc (≥45/75) cũng được xét")
    void singlePassAndSpeakingOnlyThreshold() {
        assertThat(assemble(goetheB1(), 60, 60.0, 60.0).borderline()).isFalse();
        Ergebnisbogen telc = assemble(telcB1(), 46, 42.0, 50.0);
        assertThat(telc.borderline()).isTrue();
        assertThat(telc.passed()).isTrue();
        assertThat(assemble(telcB1(), 50, 46.0, 54.0).borderline()).isFalse();
    }

    @Test
    @DisplayName("phiếu không có ngưỡng (A1) → không borderline dù khoảng rộng")
    void noThresholdNoBorderline() {
        RubricDefinition a1 = new RubricDefinition(ExamProvider.GOETHE, RubricDefinition.BandScale.VHN, Map.of(), 25, null, null, 15.0, 1.66,
                false, true, List.of(new RubricDefinition.RubricPart(1, List.of(), List.of(new RubricDefinition.RubricItem("VORSTELLUNG", "", 1)))),
                List.of(), null, null);
        List<Ergebnisbogen.CriterionResult> crit = List.of(new Ergebnisbogen.CriterionResult("VORSTELLUNG", "", "VOLL", 1, 1, true, "high", List.of()));
        Ergebnisbogen e = RubricScorer.Totals.assemble(new RubricRef(ExamProvider.GOETHE, "A1", 1), a1,
                List.of(new Ergebnisbogen.PartResult(1, crit, 1, 1, false, null)), List.of(), List.of(),
                new ArrayList<>(), new ArrayList<>(), 2, 10.0, 20.0);
        assertThat(e.borderline()).isFalse();
        assertThat(e.passed()).isNull();
    }
}
