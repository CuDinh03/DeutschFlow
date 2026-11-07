package com.deutschflow.grammar.service;

import com.deutschflow.grammar.dto.ExamBudgetDto.TeilLoss;
import com.deutschflow.grammar.service.ExamPlanBlueprints.Blueprint;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Chấm bài chẩn đoán (đợt (f)): tỉ lệ từng phần, bốn kỹ năng, dòng mất điểm cho lộ trình. */
class ExamDiagnosticScoringTest {

    private static final Blueprint TELC_B1 = ExamPlanBlueprints.find("TELC", "B1");

    private static Map<String, double[]> scores() {
        Map<String, double[]> s = new LinkedHashMap<>();
        s.put("LESEN-1", new double[] {10, 25});
        s.put("SPRACHBAUSTEINE-1", new double[] {12, 15});
        s.put("HOEREN-1", new double[] {20, 25});
        return s;
    }

    @Test
    @DisplayName("Tỉ lệ từng phần: điểm/tối đa; tự đánh giá 1–4 ⇒ 0,3 / 0,5 / 0,65 / 0,8")
    void ratios() {
        Map<String, Double> r = ExamDiagnosticScoring.ratios(scores(), Map.of("SCHREIBEN", 2, "SPRECHEN", 4));
        assertThat(r).containsEntry("LESEN", 0.4).containsEntry("SPRACHBAUSTEINE", 0.8).containsEntry("HOEREN", 0.8)
                .containsEntry("SCHREIBEN", 0.5).containsEntry("SPRECHEN", 0.8);
        assertThatThrownBy(() -> ExamDiagnosticScoring.selfRatio(5)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Bốn kỹ năng: Lesen gộp Sprachbausteine theo điểm")
    void skills() {
        Map<String, Integer> s = ExamDiagnosticScoring.skills(scores(), Map.of("SCHREIBEN", 1, "SPRECHEN", 3));
        // (10 + 12) / (25 + 15) = 55%
        assertThat(s).containsExactly(Map.entry("LESEN", 55), Map.entry("HOEREN", 80),
                Map.entry("SCHREIBEN", 30), Map.entry("SPRECHEN", 65));
    }

    @Test
    @DisplayName("Dòng mất điểm áp tỉ lệ của phần cho mọi Teil; lộ trình xếp Teil yếu nhất lên đầu")
    void lossesDriveRanking() {
        Map<String, Double> r = ExamDiagnosticScoring.ratios(scores(), Map.of("SCHREIBEN", 4, "SPRECHEN", 4));
        List<TeilLoss> losses = ExamDiagnosticScoring.losses(r, TELC_B1);
        assertThat(losses).hasSize(TELC_B1.teile().size());
        TeilLoss lesen3 = losses.stream().filter(l -> l.section().equals("LESEN") && l.teil() == 3).findFirst().orElseThrow();
        assertThat(lesen3.lost()).isEqualTo(15.0);
        // Lesen mất 15/25 mỗi Teil — nhiều nhất ⇒ ba Teil Lesen đứng đầu
        assertThat(ExamPlanGenerator.rank(TELC_B1, losses).subList(0, 3))
                .containsExactly("LESEN:1", "LESEN:2", "LESEN:3");
    }
}
