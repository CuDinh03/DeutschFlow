package com.deutschflow.grammar.service;

import com.deutschflow.grammar.dto.ExamBudgetDto;
import com.deutschflow.grammar.dto.ExamBudgetDto.GradeTarget;
import com.deutschflow.grammar.dto.ExamBudgetDto.SectionShare;
import com.deutschflow.grammar.dto.ExamBudgetDto.TeilLoss;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * LT1 — ngân sách điểm, chạy trên chính đề telc B1 Set 1 (V325): trọng số câu thật (5 / 2,5 / 1,5),
 * hai cổng, thang xếp loại 300.
 */
@DisplayName("ExamBudgetService — ngân sách điểm telc B1 (LT1)")
class ExamBudgetServiceTest {

    private static Map<String, Object> telcB1;
    private final ExamBudgetService service = new ExamBudgetService();

    @BeforeAll
    @SuppressWarnings("unchecked")
    static void loadSeed() throws Exception {
        String sql = Files.readString(Path.of("src/main/resources/db/migration/V325__mock_exam_telc_b1_set1.sql"),
                StandardCharsets.UTF_8);
        // Chú thích đầu file cũng nhắc "$j$" — lấy cặp cuối cùng (thân JSON của INSERT).
        int end = sql.lastIndexOf("$j$");
        int start = sql.lastIndexOf("$j$", end - 1) + 3;
        telcB1 = new ObjectMapper().readValue(sql.substring(start, end), Map.class);
    }

    /** Đáp án đúng hết, trừ {@code wrong[section][teil]} câu đầu của Teil đó. */
    @SuppressWarnings("unchecked")
    private static Map<String, String> answers(Map<String, Map<Integer, Integer>> wrong) {
        Map<String, String> out = new HashMap<>();
        for (Object s : (List<Object>) telcB1.get("sections")) {
            Map<String, Object> section = (Map<String, Object>) s;
            String name = (String) section.get("name");
            Object teileRaw = section.get("teile");
            if (!(teileRaw instanceof List<?> teile)) continue;
            for (Object t : teile) {
                Map<String, Object> teil = (Map<String, Object>) t;
                int teilNo = ((Number) teil.get("teil")).intValue();
                int wrongLeft = wrong.getOrDefault(name, Map.of()).getOrDefault(teilNo, 0);
                if (!(teil.get("items") instanceof List<?> items)) continue;
                for (Object i : items) {
                    Map<String, Object> item = (Map<String, Object>) i;
                    if (item.get("id") == null || item.get("correct") == null) continue;
                    String id = item.get("id").toString();
                    if (wrongLeft > 0) {
                        out.put(id, "__sai__");
                        wrongLeft--;
                    } else {
                        out.put(id, item.get("correct").toString());
                    }
                }
            }
        }
        return out;
    }

    private static Map<String, Object> detailed(String schreibenStatus, int schreibenTotal) {
        Map<String, Object> d = new LinkedHashMap<>();
        for (String s : List.of("LESEN", "SPRACHBAUSTEINE", "HOEREN")) {
            d.put(s, Map.of("status", "COMPLETED"));
        }
        d.put("SCHREIBEN", Map.of("total", schreibenTotal, "max", 45, "status", schreibenStatus));
        return d;
    }

    private static ExamScoringService.Gate oral(String status, int raw) {
        return new ExamScoringService.Gate("oral", raw, 75, 45, status, null, null);
    }

    private static ExamScoringService.Gate written() {
        return new ExamScoringService.Gate("written", 180, 225, 135, "PASSED", null, null);
    }

    @Test
    @DisplayName("xếp Teil theo ĐIỂM đã mất, ghi trọng số câu; mục tiêu xếp loại trên thang 300")
    void lossesRankedByPoints_andGradeTargets() {
        Map<String, String> answers = answers(Map.of(
                "HOEREN", Map.of(1, 2),          // 2 × 5   = 10
                "SPRACHBAUSTEINE", Map.of(1, 4), // 4 × 1,5 = 6
                "LESEN", Map.of(3, 1)));         // 1 × 2,5 = 2,5

        ExamBudgetDto b = service.compute(telcB1, answers, detailed("COMPLETED", 30),
                List.of(written(), oral("PASSED", 60)), "B1");

        assertThat(b.totalMax()).isEqualTo(300);
        assertThat(b.lost()).isEqualTo(48.5);   // 10 + 6 + 2,5 + Viết 15 + Nói 15
        assertThat(b.earned()).isEqualTo(251.5);
        assertThat(b.pending()).isFalse();

        // Hoà 15 điểm: phần lớn hơn (Nói 75) đứng trước Viết (45).
        assertThat(b.losses()).extracting(TeilLoss::section, TeilLoss::teil, TeilLoss::lost).startsWith(
                org.assertj.core.groups.Tuple.tuple("SPRECHEN", null, 15.0),
                org.assertj.core.groups.Tuple.tuple("SCHREIBEN", null, 15.0),
                org.assertj.core.groups.Tuple.tuple("HOEREN", 1, 10.0),
                org.assertj.core.groups.Tuple.tuple("SPRACHBAUSTEINE", 1, 6.0),
                org.assertj.core.groups.Tuple.tuple("LESEN", 3, 2.5));
        TeilLoss hoeren1 = b.losses().get(2);
        assertThat(hoeren1.pointPerItem()).isEqualTo(5.0);
        assertThat(hoeren1.items()).isEqualTo(5);
        assertThat(hoeren1.correct()).isEqualTo(3);
        assertThat(b.losses()).hasSize(10); // 3 + 2 + 3 Teil chấm câu + Viết + Nói

        assertThat(b.targets()).extracting(GradeTarget::grade)
                .containsExactly("SEHR_GUT", "GUT", "BEFRIEDIGEND", "AUSREICHEND");
        GradeTarget gut = b.targets().get(1);
        assertThat(gut.maxLoss()).isEqualTo(60);
        assertThat(gut.remaining()).isEqualTo(11.5);
        assertThat(gut.example()).extracting(SectionShare::section, SectionShare::maxLoss).containsExactly(
                org.assertj.core.groups.Tuple.tuple("LESEN", 15.0),
                org.assertj.core.groups.Tuple.tuple("SPRACHBAUSTEINE", 6.0),
                org.assertj.core.groups.Tuple.tuple("HOEREN", 15.0),
                org.assertj.core.groups.Tuple.tuple("SCHREIBEN", 9.0),
                org.assertj.core.groups.Tuple.tuple("SPRECHEN", 15.0));
        assertThat(b.targets().get(0).remaining()).isEqualTo(-18.5); // sehr gut: đã vượt ngân sách 30
        // Ausreichend: cách chia ví dụ không bao giờ phá cổng 60 % (viết ≤ 90, nói ≤ 30).
        GradeTarget ausreichend = b.targets().get(3);
        double writtenShare = ausreichend.example().stream().filter(s -> !s.section().equals("SPRECHEN"))
                .mapToDouble(SectionShare::maxLoss).sum();
        assertThat(writtenShare).isLessThanOrEqualTo(90);
    }

    @Test
    @DisplayName("chưa thi Nói + bài viết chờ chấm: hai dòng 'chưa chấm' ở cuối, không tính vào điểm mất")
    void pendingPartsGoLast_andStayOutOfTotals() {
        ExamBudgetDto b = service.compute(telcB1, answers(Map.of("LESEN", Map.of(1, 1))),
                detailed("PENDING_AI_EVALUATION", 0), List.of(written(), oral("PENDING", 0)), "B1");

        assertThat(b.pending()).isTrue();
        assertThat(b.lost()).isEqualTo(5);
        assertThat(b.losses().get(0)).extracting(TeilLoss::section, TeilLoss::teil).containsExactly("LESEN", 1);
        List<TeilLoss> tail = b.losses().subList(b.losses().size() - 2, b.losses().size());
        assertThat(tail).allMatch(TeilLoss::pending);
        assertThat(tail).extracting(TeilLoss::section).containsExactlyInAnyOrder("SCHREIBEN", "SPRECHEN");
        assertThat(tail).allMatch(r -> r.lost() == null && r.earned() == null);
        assertThat(b.targets().get(1).remaining()).isEqualTo(55); // gut: 60 − 5
    }

    @Test
    @DisplayName("đề Goethe (không pass_rule) ⇒ không có khối ngân sách; bậc chưa có bảng ⇒ không có mục tiêu")
    void goetheHasNoBudget_unknownScaleHasNoTargets() {
        Map<String, Object> goethe = new HashMap<>(telcB1);
        goethe.remove("pass_rule");
        assertThat(service.compute(goethe, Map.of(), Map.of(), List.of(), "B1")).isNull();

        ExamBudgetDto b2 = service.compute(telcB1, answers(Map.of()), detailed("COMPLETED", 45),
                List.of(written(), oral("PASSED", 75)), "B2");
        assertThat(b2.targets()).isEmpty();
        assertThat(b2.lost()).isZero();
    }

    @Test
    @DisplayName("thiếu phần Nói (tổng ≠ 300) ⇒ không bịa mục tiêu xếp loại")
    void totalMismatchDropsTargets() {
        ExamBudgetDto b = service.compute(telcB1, answers(Map.of()), detailed("COMPLETED", 45),
                List.of(written()), "B1");
        assertThat(b.totalMax()).isEqualTo(225);
        assertThat(b.targets()).isEmpty();
    }
}
