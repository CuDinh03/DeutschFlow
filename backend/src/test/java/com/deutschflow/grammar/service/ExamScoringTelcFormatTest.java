package com.deutschflow.grammar.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Luật chấm riêng của định dạng telc (Zertifikat Deutsch B1), thêm 15/09/2026.
 *
 * <p>Hai thứ đề Goethe không cần mà telc thì bắt buộc:
 * <ul>
 *   <li><b>Trọng số câu khác nhau NGAY TRONG một phần</b> — Leseverstehen cho 5 đ/câu ở Teil 1–2
 *       nhưng 2,5 đ/câu ở Teil 3. Luật tỉ lệ cũ chia đều nên đề telc chấm bằng nó sẽ sai điểm
 *       ngay từ bài đầu tiên.</li>
 *   <li><b>Hai ngưỡng đỗ độc lập</b> — 135/225 phần viết và 45/75 phần nói, giỏi bên này không bù
 *       được bên kia.</li>
 * </ul>
 *
 * <p>Mọi ca ở đây phải không đụng tới đề Goethe: đề nào không khai {@code point_per_item} và
 * {@code pass_rule} thì giữ nguyên hành vi cũ — có ca chốt chặn hồi quy bên dưới.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ExamScoringService — định dạng telc")
class ExamScoringTelcFormatTest {

    @Mock AiExamEvaluatorService aiEvaluator;
    @InjectMocks ExamScoringService service;

    // ─── Trọng số câu (G2) ───────────────────────────────────────────────────

    @Test
    @DisplayName("Leseverstehen telc làm đúng hết ra trọn 75 điểm (5 + 5 + 2,5 đ/câu)")
    void objective_telcWeights_allCorrect_givesSectionMax() {
        Map<String, Object> section = telcLesen();
        Map<String, Object> answers = allCorrect(section);

        Map<String, Object> result = service.scoreObjectiveSection(answers, section);

        assertThat(result.get("total")).isEqualTo(75);
        assertThat(result.get("max")).isEqualTo(75);
        assertThat(result.get("total_items")).isEqualTo(20);
        assertThat(result.get("status")).isEqualTo(ExamScoringService.STATUS_COMPLETED);
    }

    @Test
    @DisplayName("sai 5 câu Teil 3 (2,5 đ) chỉ mất 12,5 điểm, không mất 1/4 phần")
    void objective_telcWeights_wrongCheapItems_costTheirOwnWeight() {
        Map<String, Object> section = telcLesen();
        Map<String, Object> answers = allCorrect(section);
        for (int i = 1; i <= 5; i++) answers.put("LV3-" + i, "sai");

        Map<String, Object> result = service.scoreObjectiveSection(answers, section);

        // 25 + 25 + (5 × 2,5) = 62,5 → làm tròn 63. Luật tỉ lệ cũ sẽ ra 75 × 15/20 = 56.
        assertThat(result.get("total")).isEqualTo(63);
        assertThat(result.get("correct_items")).isEqualTo(15);
    }

    @Test
    @DisplayName("sai 5 câu Teil 1 (5 đ) mất đúng 25 điểm — cùng số câu nhưng đắt gấp đôi Teil 3")
    void objective_telcWeights_wrongExpensiveItems_costMore() {
        Map<String, Object> section = telcLesen();
        Map<String, Object> answers = allCorrect(section);
        for (int i = 1; i <= 5; i++) answers.put("LV1-" + i, "sai");

        Map<String, Object> result = service.scoreObjectiveSection(answers, section);

        assertThat(result.get("total")).isEqualTo(50);
        assertThat(result.get("correct_items")).isEqualTo(15);
    }

    @Test
    @DisplayName("điểm khai ở cấp câu đè lên point_per_item của Teil")
    void objective_itemPoints_overrideTeilPointPerItem() {
        Map<String, Object> section = new HashMap<>();
        section.put("max_points", 10);
        section.put("teile", List.of(Map.of("teil", 1, "point_per_item", 2, "items", List.of(
                Map.of("id", "Q1", "correct", "a"),
                Map.of("id", "Q2", "correct", "a", "points", 8)))));
        Map<String, Object> answers = new HashMap<>(Map.of("Q1", "sai", "Q2", "a"));

        Map<String, Object> result = service.scoreObjectiveSection(answers, section);

        assertThat(result.get("total")).isEqualTo(8);
        assertThat(result.get("max")).isEqualTo(10);
    }

    @Test
    @DisplayName("HỒI QUY: đề Goethe không khai trọng số vẫn chấm theo tỉ lệ như cũ")
    void objective_noWeightsDeclared_keepsRatioRule() {
        Map<String, Object> section = new HashMap<>();
        section.put("max_points", 25);
        section.put("teile", List.of(Map.of("teil", 1, "items", List.of(
                Map.of("id", "L1", "correct", "richtig"),
                Map.of("id", "L2", "correct", "falsch"),
                Map.of("id", "L3", "correct", "richtig"),
                Map.of("id", "L4", "correct", "richtig")))));
        Map<String, Object> answers = new HashMap<>(Map.of(
                "L1", "richtig", "L2", "falsch", "L3", "richtig", "L4", "falsch"));

        Map<String, Object> result = service.scoreObjectiveSection(answers, section);

        assertThat(result.get("total")).isEqualTo(19); // 25 × 3/4, y hệt trước
    }

    @Test
    @DisplayName("khai trọng số nửa vời thì quay về luật tỉ lệ, không tự bịa điểm cho câu thiếu")
    void objective_partialWeights_fallsBackToRatioInsteadOfInventing() {
        Map<String, Object> section = new HashMap<>();
        section.put("max_points", 20);
        section.put("teile", List.of(
                Map.of("teil", 1, "point_per_item", 5, "items", List.of(
                        Map.of("id", "A1", "correct", "a"),
                        Map.of("id", "A2", "correct", "a"))),
                // Teil 2 quên khai point_per_item — seed lỗi.
                Map.of("teil", 2, "items", List.of(
                        Map.of("id", "B1", "correct", "a"),
                        Map.of("id", "B2", "correct", "a")))));
        Map<String, Object> answers = new HashMap<>(Map.of("A1", "a", "A2", "a", "B1", "a", "B2", "sai"));

        Map<String, Object> result = service.scoreObjectiveSection(answers, section);

        assertThat(result.get("total")).isEqualTo(15); // 20 × 3/4 — tỉ lệ, không phải 10 + bịa
        assertThat(result.get("max")).isEqualTo(20);
    }

    // ─── Sprachbausteine (G1) ────────────────────────────────────────────────

    @Test
    @DisplayName("SPRACHBAUSTEINE vào tổng điểm — trước đây phần này bị bỏ ra ngoài im lặng")
    void summarize_sprachbausteine_countsTowardTotal() {
        Map<String, Object> detailed = new LinkedHashMap<>();
        detailed.put("LESEN", scored(75, 75));
        detailed.put("SPRACHBAUSTEINE", scored(15, 30));

        ExamScoringService.ExamTotals totals = service.summarize(detailed, 60);

        assertThat(totals.rawPoints()).isEqualTo(90);
        assertThat(totals.scoredMax()).isEqualTo(105);
    }

    @Test
    @DisplayName("SPRACHBAUSTEINE dưới 60% bị gọi tên là điểm yếu")
    void identifyWeakAreas_includesSprachbausteine() {
        Map<String, Object> detailed = new LinkedHashMap<>();
        detailed.put("LESEN", scored(70, 75));
        detailed.put("SPRACHBAUSTEINE", scored(12, 30));

        assertThat(service.identifyWeakAreas(detailed)).containsExactly("SPRACHBAUSTEINE");
    }

    // ─── Hai ngưỡng độc lập (G3) ─────────────────────────────────────────────

    @Test
    @DisplayName("đề telc làm đúng hết phần viết ra 225 điểm và cổng Viết ĐẠT")
    void summarize_telcAllCorrect_writtenGatePasses() {
        ExamScoringService.ExamTotals totals = service.summarize(telcPerfectWritten(), 60, telcPassRule());

        assertThat(totals.rawPoints()).isEqualTo(225);
        assertThat(totals.scoredMax()).isEqualTo(225);
        assertThat(gate(totals, "written").raw()).isEqualTo(225);
        assertThat(gate(totals, "written").max()).isEqualTo(225);
        assertThat(gate(totals, "written").min()).isEqualTo(135);
        assertThat(gate(totals, "written").status()).isEqualTo(ExamScoringService.GATE_PASSED);
    }

    @Test
    @DisplayName("chưa ghép phiên thi Nói thì cổng Nói là CHỜ — không phải trượt, nhưng cũng chưa phải đỗ")
    void summarize_telc_oralGatePendingWhenNoSpeakingSession() {
        ExamScoringService.ExamTotals totals = service.summarize(telcPerfectWritten(), 60, telcPassRule());

        assertThat(gate(totals, "oral").status()).isEqualTo(ExamScoringService.GATE_PENDING);
        assertThat(gate(totals, "oral").max()).isEqualTo(75);
        assertThat(gate(totals, "oral").min()).isEqualTo(45);
        // SỬA 15/09/2026 (đợt 3): bản đầu để `passed = true` ở đây, theo nguyên tắc "chưa chấm
        // được thì đừng đánh trượt". Nguyên tắc đó đúng cho một PHẦN chưa chấm được, nhưng sai
        // cho một CỔNG chưa thi — và cột `passed` này chính là thứ `/api/certificates/claim`
        // lọc theo, nên để lỏng là mở một đường lấy chứng nhận bằng nửa kỳ thi.
        assertThat(totals.passed()).isFalse();
        assertThat(gate(totals, "written").status())
                .as("vẫn phải nói rõ phần viết đã ĐẠT — 'chưa đỗ' không được đọc thành 'trượt'")
                .isEqualTo(ExamScoringService.GATE_PASSED);
    }

    @Test
    @DisplayName("134/225 là TRƯỢT phần viết dù đúng 59,6% — ngưỡng là điểm tuyệt đối, không phải phần trăm làm tròn")
    void summarize_telc_oneMarkBelowThreshold_fails() {
        Map<String, Object> detailed = new LinkedHashMap<>();
        detailed.put("LESEN", scored(45, 75));
        detailed.put("SPRACHBAUSTEINE", scored(18, 30));
        detailed.put("HOEREN", scored(45, 75));
        detailed.put("SCHREIBEN", scored(26, 45));

        ExamScoringService.ExamTotals totals = service.summarize(detailed, 60, telcPassRule());

        assertThat(gate(totals, "written").raw()).isEqualTo(134);
        assertThat(gate(totals, "written").status()).isEqualTo(ExamScoringService.GATE_FAILED);
        assertThat(totals.passed()).isFalse();
    }

    @Test
    @DisplayName("thiếu một phần của cổng thì cổng đó là CHỜ — không đem 70 điểm ra so với ngưỡng 135")
    void summarize_telc_incompleteGate_isPendingNotFailed() {
        Map<String, Object> detailed = new LinkedHashMap<>();
        detailed.put("LESEN", scored(70, 75));
        detailed.put("SPRACHBAUSTEINE", pending(30));

        ExamScoringService.ExamTotals totals = service.summarize(detailed, 60, telcPassRule());

        assertThat(gate(totals, "written").status()).isEqualTo(ExamScoringService.GATE_PENDING);
        assertThat(totals.passed()).isFalse();
    }

    @Test
    @DisplayName("HỒI QUY: đề không khai pass_rule vẫn kết luận bằng ngưỡng phần trăm như cũ")
    void summarize_noPassRule_keepsPercentRule() {
        Map<String, Object> detailed = new LinkedHashMap<>();
        detailed.put("LESEN", scored(20, 25));
        detailed.put("HOEREN", scored(15, 25));

        ExamScoringService.ExamTotals totals = service.summarize(detailed, 60, null);

        assertThat(totals.totalScore()).isEqualTo(70);
        assertThat(totals.passed()).isTrue();
        assertThat(totals.gates()).isEmpty();
    }

    // ─── Dữ liệu dựng sẵn ────────────────────────────────────────────────────

    /** Leseverstehen telc B1: Teil 1 (5 câu × 5đ), Teil 2 (5 câu × 5đ), Teil 3 (10 câu × 2,5đ) = 75. */
    private Map<String, Object> telcLesen() {
        Map<String, Object> section = new HashMap<>();
        section.put("max_points", 75);
        section.put("teile", List.of(
                weightedTeil(1, "LV1", 5, 5.0),
                weightedTeil(2, "LV2", 5, 5.0),
                weightedTeil(3, "LV3", 10, 2.5)));
        return section;
    }

    private Map<String, Object> weightedTeil(int teilNo, String idPrefix, int count, double pointPerItem) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (int i = 1; i <= count; i++) {
            items.add(Map.of("id", idPrefix + "-" + i, "correct", "a"));
        }
        return Map.of("teil", teilNo, "point_per_item", pointPerItem, "items", items);
    }

    private Map<String, Object> allCorrect(Map<String, Object> section) {
        Map<String, Object> answers = new HashMap<>();
        for (Object teilObj : (List<?>) section.get("teile")) {
            Map<?, ?> teil = (Map<?, ?>) teilObj;
            for (Object itemObj : (List<?>) teil.get("items")) {
                Map<?, ?> item = (Map<?, ?>) itemObj;
                answers.put(item.get("id").toString(), item.get("correct").toString());
            }
        }
        return answers;
    }

    private Map<String, Object> telcPerfectWritten() {
        Map<String, Object> detailed = new LinkedHashMap<>();
        detailed.put("LESEN", scored(75, 75));
        detailed.put("SPRACHBAUSTEINE", scored(30, 30));
        detailed.put("HOEREN", scored(75, 75));
        detailed.put("SCHREIBEN", scored(45, 45));
        return detailed;
    }

    private Map<String, Object> telcPassRule() {
        return Map.of(
                "written", Map.of("sections", List.of("LESEN", "SPRACHBAUSTEINE", "HOEREN", "SCHREIBEN"),
                        "max", 225, "min", 135),
                "oral", Map.of("source", "SPEAKING_SESSION", "provider", "TELC", "max", 75, "min", 45));
    }

    private ExamScoringService.Gate gate(ExamScoringService.ExamTotals totals, String id) {
        return totals.gates().stream().filter(g -> g.id().equals(id)).findFirst()
                .orElseThrow(() -> new AssertionError("không có cổng '" + id + "' trong " + totals.gates()));
    }

    private Map<String, Object> scored(int total, int max) {
        return Map.of("total", total, "max", max, "status", ExamScoringService.STATUS_COMPLETED);
    }

    private Map<String, Object> pending(int max) {
        return Map.of("total", 0, "max", max, "status", ExamScoringService.STATUS_PENDING);
    }
}
