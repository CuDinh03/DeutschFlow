package com.deutschflow.grammar.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Điểm từng Teil của lượt thi thử cho "Bốn kỹ năng" (09/11/2026, Đợt 5). */
class MockAttemptTeilScoresTest {

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

    private static final Map<String, Object> WRITING_GRADED = Map.of(
            "SCHREIBEN", Map.of("total", 30, "max", 45, "percentage", 67, "status", "COMPLETED"));

    @Test
    void luotDaNop_teilCoTraLoiDuocTinh_teilBoTrangKhongKeoDiemXuong() {
        var scores = MockAttemptTeilScores.of("COMPLETED", exam(),
                Map.of("L1-1", "a", "L1-2", "b", "L2-1", "b"), Map.of());

        assertThat(scores).extracting(MockAttemptTeilScores.Score::key).containsExactly("LESEN-1", "LESEN-2");
        assertThat(scores.get(0).score()).isEqualTo(10.0);
        assertThat(scores.get(0).max()).isEqualTo(10.0);
        // LESEN-2: 1 câu sai + 1 câu trống ⇒ 0/10, vẫn tính vì đã chạm.
        assertThat(scores.get(1).score()).isEqualTo(0.0);
        assertThat(scores.get(1).section()).isEqualTo("LESEN");
        assertThat(scores.get(1).teil()).isEqualTo(2);
    }

    @Test
    void luotDaNop_vietDaChamXong_coDiemTeilViet() {
        var scores = MockAttemptTeilScores.of("COMPLETED", exam(), Map.of("email_1", "Liebe Anna"), WRITING_GRADED);

        assertThat(scores).singleElement().satisfies(s -> {
            assertThat(s.key()).isEqualTo("SCHREIBEN-1");
            assertThat(s.score()).isEqualTo(30.0);
            assertThat(s.max()).isEqualTo(45.0);
        });
    }

    @Test
    void luotDaNop_vietBoTrang_phanCompleted0_khongKeoDiemVietVe0() {
        var blank = Map.<String, Object>of(
                "SCHREIBEN", Map.of("total", 0, "max", 45, "percentage", 0, "status", "COMPLETED"));

        assertThat(MockAttemptTeilScores.of("COMPLETED", exam(), Map.of("L1-1", "a", "email_1", "   "), blank))
                .extracting(MockAttemptTeilScores.Score::key).containsExactly("LESEN-1");
    }

    @Test
    void vietChuaChamXong_khongCoDiem() {
        var pending = Map.<String, Object>of(
                "SCHREIBEN", Map.of("total", 0, "max", 45, "status", ExamScoringService.STATUS_PENDING));

        assertThat(MockAttemptTeilScores.of("COMPLETED", exam(), Map.of("email_1", "x"), pending)).isEmpty();
    }

    @Test
    void luotDung_vietKhongBaoGioCoDiem_khachQuanTheoLuatDaCham() {
        var scores = MockAttemptTeilScores.of("PARTIAL", exam(), Map.of("H1-1", "a", "email_1", "x"), WRITING_GRADED);

        assertThat(scores).extracting(MockAttemptTeilScores.Score::key).containsExactly("HOEREN-1");
        assertThat(scores.get(0).score()).isEqualTo(5.0);
    }

    @Test
    void deCoHaiTeilViet_khongGanDiemPhanChoTeilNao() {
        Map<String, Object> twoWriting = Map.of("sections", List.of(
                Map.of("name", "SCHREIBEN", "teile", List.of(Map.of("teil", 1, "type", "EMAIL"), Map.of("teil", 2, "type", "FORUM")))));

        assertThat(MockAttemptTeilScores.of("COMPLETED", twoWriting, Map.of("email_1", "x"), WRITING_GRADED)).isEmpty();
    }

    @Test
    void khongTraLoiGi_khongCoDiemNao() {
        assertThat(MockAttemptTeilScores.of("COMPLETED", exam(), Map.of(), null)).isEmpty();
    }
}
