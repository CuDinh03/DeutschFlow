package com.deutschflow.grammar.service;

import com.deutschflow.grammar.dto.ExamBudgetDto.TeilLoss;
import com.deutschflow.grammar.service.ExamPlanBlueprints.Blueprint;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Chấm bài chẩn đoán (đợt (f)): tỉ lệ từng phần, bốn kỹ năng, dòng mất điểm cho lộ trình. */
class ExamDiagnosticScoringTest {

    private static final Blueprint TELC_B1 = ExamPlanBlueprints.find("TELC", "B1");

    private static Map<String, double[]> scores() {
        Map<String, double[]> s = new LinkedHashMap<>();
        s.put("LESEN-1", new double[] {10, 25});
        s.put("SPRACHBAUSTEINE-1", new double[] {12, 15});
        s.put("HOEREN-1", new double[] {20, 25});
        s.put("SCHREIBEN-1", new double[] {33, 45});
        return s;
    }

    @Test
    @DisplayName("Tỉ lệ từng phần: điểm/tối đa, Viết theo phiếu AI, Nói theo lượt thi nói")
    void ratios() {
        Map<String, Double> r = ExamDiagnosticScoring.ratios(scores(), new double[] {45, 75});
        assertThat(r).containsEntry("LESEN", 0.4).containsEntry("SPRACHBAUSTEINE", 0.8).containsEntry("HOEREN", 0.8)
                .containsEntry("SCHREIBEN", 0.733).containsEntry("SPRECHEN", 0.6);
        assertThat(ExamDiagnosticScoring.ratios(scores(), null)).doesNotContainKey("SPRECHEN");
    }

    @Test
    @DisplayName("Bốn kỹ năng: Lesen gộp Sprachbausteine theo điểm")
    void skills() {
        Map<String, Integer> s = ExamDiagnosticScoring.skills(scores(), new double[] {45, 75});
        // (10 + 12) / (25 + 15) = 55%
        assertThat(s).containsExactly(Map.entry("LESEN", 55), Map.entry("HOEREN", 80),
                Map.entry("SCHREIBEN", 73), Map.entry("SPRECHEN", 60));
    }

    @Test
    @DisplayName("Dòng mất điểm áp tỉ lệ của phần cho mọi Teil; lộ trình xếp Teil yếu nhất lên đầu")
    void lossesDriveRanking() {
        Map<String, Double> r = ExamDiagnosticScoring.ratios(scores(), new double[] {70, 75});
        List<TeilLoss> losses = ExamDiagnosticScoring.losses(r, TELC_B1);
        assertThat(losses).hasSize(TELC_B1.teile().size());
        TeilLoss lesen3 = losses.stream().filter(l -> l.section().equals("LESEN") && l.teil() == 3).findFirst().orElseThrow();
        assertThat(lesen3.lost()).isEqualTo(15.0);
        // Lesen mất 15/25 mỗi Teil — nhiều nhất ⇒ ba Teil Lesen đứng đầu
        assertThat(ExamPlanGenerator.rank(TELC_B1, losses).subList(0, 3))
                .containsExactly("LESEN:1", "LESEN:2", "LESEN:3");
    }

    /** Đủ chín Teil như đề thật, trọng số telc B1: Lesen 25×3, Sprachbausteine 15×2, Hören 25×3, Schreiben 45. */
    private static Map<String, double[]> fullScores() {
        Map<String, double[]> s = new LinkedHashMap<>();
        s.put("LESEN-1", new double[] {25, 25});
        s.put("LESEN-2", new double[] {10, 25});
        s.put("LESEN-3", new double[] {15, 25});
        s.put("SPRACHBAUSTEINE-1", new double[] {12, 15});
        s.put("SPRACHBAUSTEINE-2", new double[] {6, 15});
        s.put("HOEREN-1", new double[] {20, 25});
        s.put("HOEREN-2", new double[] {5, 25});
        s.put("HOEREN-3", new double[] {20, 25});
        s.put("SCHREIBEN-1", new double[] {36, 45});
        return s;
    }

    @Test
    @DisplayName("Danh sách phần: đủ mọi Teil theo thứ tự thi thật; đề thiếu Teil thì chỉ lấy Teil đề có")
    void teileInExamOrder() {
        assertThat(ExamDiagnosticScoring.TEILE).containsExactly(
                "LESEN-1", "LESEN-2", "LESEN-3", "SPRACHBAUSTEINE-1", "SPRACHBAUSTEINE-2",
                "HOEREN-1", "HOEREN-2", "HOEREN-3", "SCHREIBEN-1");
        assertThat(ExamDiagnosticScoring.TEILE).containsAll(ExamDiagnosticScoring.CORE_TEILE);
        // mọi Teil phần viết của blueprint telc B1 đều có trong bài chẩn đoán
        assertThat(TELC_B1.teile().stream().filter(t -> !t.section().equals("SPRECHEN"))
                .map(t -> t.section() + "-" + t.teil()).toList()).isEqualTo(ExamDiagnosticScoring.TEILE);
        assertThat(ExamDiagnosticScoring.present(List.of("SCHREIBEN-1", "HOEREN-1", "LESEN-2", "LESEN-1", "KHAC-1")))
                .containsExactly("LESEN-1", "LESEN-2", "HOEREN-1", "SCHREIBEN-1");
    }

    @Test
    @DisplayName("Nhiều Teil mỗi phần: tỉ lệ phần và kỹ năng gộp theo điểm thật của từng Teil")
    void multiTeilAggregation() {
        Map<String, Double> r = ExamDiagnosticScoring.ratios(fullScores(), new double[] {45, 75});
        // Lesen 50/75, Sprachbausteine 18/30, Hören 45/75
        assertThat(r).containsEntry("LESEN", 0.667).containsEntry("SPRACHBAUSTEINE", 0.6).containsEntry("HOEREN", 0.6)
                .containsEntry("SCHREIBEN", 0.8).containsEntry("SPRECHEN", 0.6);
        assertThat(ExamDiagnosticScoring.teilRatios(fullScores())).hasSize(9)
                .containsEntry("LESEN-2", 0.4).containsEntry("HOEREN-2", 0.2).containsEntry("SPRACHBAUSTEINE-2", 0.4);

        Map<String, Integer> s = ExamDiagnosticScoring.skills(fullScores(), new double[] {45, 75});
        // Lesen = (50 + 18) / (75 + 30) = 64,8% ⇒ 65; không phải trung bình cộng các tỉ lệ Teil
        assertThat(s).containsExactly(Map.entry("LESEN", 65), Map.entry("HOEREN", 60),
                Map.entry("SCHREIBEN", 80), Map.entry("SPRECHEN", 60));
    }

    @Test
    @DisplayName("Teil nặng điểm kéo kỹ năng nhiều hơn: sai hết Teil 25 điểm khác sai hết Teil 15 điểm")
    void weightsFollowExamPoints() {
        Map<String, double[]> a = new LinkedHashMap<>();
        a.put("LESEN-1", new double[] {0, 25});
        a.put("SPRACHBAUSTEINE-1", new double[] {15, 15});
        Map<String, double[]> b = new LinkedHashMap<>();
        b.put("LESEN-1", new double[] {25, 25});
        b.put("SPRACHBAUSTEINE-1", new double[] {0, 15});
        assertThat(ExamDiagnosticScoring.skills(a, null)).containsEntry("LESEN", 38);
        assertThat(ExamDiagnosticScoring.skills(b, null)).containsEntry("LESEN", 63);
    }

    @Test
    @DisplayName("Lộ trình: Teil đã đo dùng tỉ lệ của chính nó, phần Nói và kết quả bản ngắn dùng tỉ lệ phần")
    void lossesPerTeil() {
        Map<String, Double> r = ExamDiagnosticScoring.ratios(fullScores(), new double[] {60, 75});
        List<TeilLoss> losses = ExamDiagnosticScoring.losses(r, ExamDiagnosticScoring.teilRatios(fullScores()), TELC_B1);
        assertThat(losses).hasSize(TELC_B1.teile().size());
        assertThat(lost(losses, "LESEN", 1)).isEqualTo(0.0);
        assertThat(lost(losses, "LESEN", 2)).isEqualTo(15.0);
        assertThat(lost(losses, "HOEREN", 2)).isEqualTo(20.0);
        assertThat(lost(losses, "SPRACHBAUSTEINE", 2)).isEqualTo(9.0);
        // Nói chỉ có tổng điểm ⇒ 80% cho cả ba Teil theo trọng số 15/30/30
        assertThat(lost(losses, "SPRECHEN", 1)).isCloseTo(3.0, org.assertj.core.data.Offset.offset(1e-9));
        assertThat(lost(losses, "SPRECHEN", 3)).isCloseTo(6.0, org.assertj.core.data.Offset.offset(1e-9));
        // Hören 2 mất nhiều nhất ⇒ đứng đầu, dù cả phần Hören chỉ ngang Sprachbausteine
        assertThat(ExamPlanGenerator.rank(TELC_B1, losses).get(0)).isEqualTo("HOEREN:2");

        // Kết quả bản ngắn (không có tỉ lệ từng Teil): mọi Teil của phần dùng chung tỉ lệ phần như trước
        List<TeilLoss> legacy = ExamDiagnosticScoring.losses(Map.of("HOEREN", 0.8), Map.of(), TELC_B1);
        assertThat(legacy).hasSize(3).allSatisfy(l -> assertThat(l.lost()).isCloseTo(5.0, org.assertj.core.data.Offset.offset(1e-9)));
    }

    private static double lost(List<TeilLoss> losses, String section, int teil) {
        return losses.stream().filter(l -> l.section().equals(section) && l.teil() == teil).findFirst().orElseThrow().lost();
    }
}
