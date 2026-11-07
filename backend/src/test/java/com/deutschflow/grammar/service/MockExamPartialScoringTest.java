package com.deutschflow.grammar.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Lượt thi thử dừng giữa chừng (owner chốt 07/11/2026): chỉ Teil đã chạm ≥ 1 câu được tính. */
class MockExamPartialScoringTest {

    private static Map<String, Object> teil(int no, String prefix) {
        return Map.of("teil", no, "type", "MULTIPLE_CHOICE", "point_per_item", 5,
                "items", List.of(
                        Map.of("id", prefix + "-1", "question", "F1", "correct", "a", "options", Map.of("a", "x", "b", "y")),
                        Map.of("id", prefix + "-2", "question", "F2", "correct", "b", "options", Map.of("a", "x", "b", "y"))));
    }

    private static Map<String, Object> exam() {
        return Map.of("sections", List.of(
                Map.of("name", "LESEN", "teile", List.of(teil(1, "L1"), teil(2, "L2"))),
                Map.of("name", "HOEREN", "teile", List.of(teil(1, "H1"))),
                Map.of("name", "SCHREIBEN", "teile", List.of(Map.of("teil", 1, "type", "EMAIL")))));
    }

    @Test
    void chiTeilDaChamMotCauDuocTinhCauTrongTrongTeilDoTinh0() {
        var s = MockExamPartialScoring.score(exam(), Map.of("L1-1", "a", "L1-2", "b", "L2-1", "b"));

        assertThat(s.teileTotal()).isEqualTo(4);
        assertThat(s.teileDone()).isEqualTo(2);
        assertThat(s.teileCounted()).isEqualTo(2);
        var l1 = s.teile().get(0);
        assertThat(l1.key()).isEqualTo("LESEN-1");
        assertThat(l1.status()).isEqualTo(MockExamPartialScoring.SCORED);
        assertThat(l1.score()).isEqualTo(10.0);
        assertThat(l1.max()).isEqualTo(10.0);
        var l2 = s.teile().get(1);
        assertThat(l2.status()).isEqualTo(MockExamPartialScoring.SCORED);
        assertThat(l2.score()).isEqualTo(0.0); // 1 câu sai + 1 câu trống
        assertThat(l2.answered()).isEqualTo(1);
        assertThat(l2.total()).isEqualTo(2);
        assertThat(s.teile().get(2).status()).isEqualTo(MockExamPartialScoring.NOT_ATTEMPTED);
        assertThat(s.teile().get(2).score()).isNull();
    }

    @Test
    void vietDoKhongCham() {
        var s = MockExamPartialScoring.score(exam(), Map.of("email_1", "Liebe Anna, danke"));

        var w = s.teile().get(3);
        assertThat(w.key()).isEqualTo("SCHREIBEN-1");
        assertThat(w.status()).isEqualTo(MockExamPartialScoring.WRITTEN_NOT_GRADED);
        assertThat(w.score()).isNull();
        assertThat(s.teileDone()).isEqualTo(1);
        assertThat(s.teileCounted()).isZero();
        assertThat(s.touched()).isTrue();
    }

    @Test
    void chuaChamCauNaoThiKhongCoGiDeLuu() {
        var s = MockExamPartialScoring.score(exam(), Map.of("email_1", "   "));

        assertThat(s.touched()).isFalse();
        assertThat(s.teile()).allMatch(t -> MockExamPartialScoring.NOT_ATTEMPTED.equals(t.status()));
    }

    @Test
    void jsonLuuKhoiPartialVaDiemTungTeil() {
        var s = MockExamPartialScoring.score(exam(), Map.of("L1-1", "a"));
        var json = MockExamPartialScoring.detailedJson(s, MockExamStopService.REASON_STOPPED);

        assertThat(json).containsKeys("partial", "teile");
        @SuppressWarnings("unchecked")
        var partial = (Map<String, Object>) json.get("partial");
        assertThat(partial).containsEntry("reason", "STOPPED").containsEntry("teile_done", 1).containsEntry("teile_total", 4);
        @SuppressWarnings("unchecked")
        var teile = (Map<String, Map<String, Object>>) json.get("teile");
        assertThat(teile.get("LESEN-1")).containsEntry("status", "SCORED").containsEntry("score", 5.0).containsEntry("max", 10.0);
        assertThat(teile.get("HOEREN-1")).containsEntry("status", "NOT_ATTEMPTED").doesNotContainKey("score");
    }
}
