package com.deutschflow.teacher.service;

import com.deutschflow.teacher.dto.GradingEvalResponse;
import com.deutschflow.teacher.dto.GradingEvalResponse.CaseScore;
import com.deutschflow.teacher.dto.GradingEvalResponse.ModelResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests cho phần tính số liệu thuần của {@link GradingEvalService#computeMetrics}.
 * Việc gọi AI được tách khỏi phép toán để test không cần model thật.
 */
class GradingEvalServiceTest {

    @Test
    @DisplayName("MAE, bias, within-5 tính đúng cho điểm chấm được")
    void metrics_basic() {
        // ref vs ai: (80,85)+5 | (70,68)-2 | (60,72)+12
        var m = GradingEvalService.computeMetrics(List.of(
                new CaseScore(80, 85),
                new CaseScore(70, 68),
                new CaseScore(60, 72)));

        assertThat(m.graded()).isEqualTo(3);
        assertThat(m.failed()).isZero();
        // |5|+|2|+|12| = 19 / 3 = 6.33
        assertThat(m.mae()).isEqualTo(6.33);
        // (5 -2 +12) / 3 = 5.0 → model chấm cao hơn giám khảo
        assertThat(m.meanBias()).isEqualTo(5.0);
        // within 5: case1 (5) và case2 (2) đạt; case3 (12) không → 2/3 = 0.67
        assertThat(m.withinFiveRate()).isEqualTo(0.67);
    }

    @Test
    @DisplayName("bài model chấm fail (aiScore null) được đếm failed và loại khỏi MAE")
    void metrics_skipsFailures() {
        var m = GradingEvalService.computeMetrics(List.of(
                new CaseScore(80, 80),
                new CaseScore(70, null),
                new CaseScore(90, 88)));

        assertThat(m.graded()).isEqualTo(2);
        assertThat(m.failed()).isEqualTo(1);
        // |0| + |2| = 2 / 2 = 1.0
        assertThat(m.mae()).isEqualTo(1.0);
        assertThat(m.withinFiveRate()).isEqualTo(1.0);
    }

    @Test
    @DisplayName("model chấm fail toàn bộ → MAE null (xếp cuối khi sort)")
    void metrics_allFailed() {
        var m = GradingEvalService.computeMetrics(List.of(
                new CaseScore(80, null),
                new CaseScore(70, null)));

        assertThat(m.graded()).isZero();
        assertThat(m.failed()).isEqualTo(2);
        assertThat(m.mae()).isNull();
        assertThat(m.meanBias()).isNull();
        assertThat(m.withinFiveRate()).isNull();
    }

    @Test
    @DisplayName("khớp tuyệt đối → MAE 0, bias 0, within-5 = 1.0")
    void metrics_perfect() {
        var m = GradingEvalService.computeMetrics(List.of(
                new CaseScore(75, 75),
                new CaseScore(60, 60)));

        assertThat(m.mae()).isZero();
        assertThat(m.meanBias()).isZero();
        assertThat(m.withinFiveRate()).isEqualTo(1.0);
    }

    @Test
    @DisplayName("default model list chỉ gồm model Groq còn sống — không còn llama đã/sắp khai tử (R-B5)")
    void defaultModels() {
        assertThat(GradingEvalService.DEFAULT_MODELS)
                .containsExactly(
                        "openai/gpt-oss-120b",
                        "openai/gpt-oss-20b");
        // Chốt chặn hồi quy: không được để model Groq đã khai tử quay lại danh sách mặc định.
        assertThat(GradingEvalService.DEFAULT_MODELS)
                .noneMatch(m -> m.contains("llama"));
        // Ứng viên P3 KHÔNG được nằm trong bộ mặc định: mỗi ứng viên cần ngân sách token riêng
        // (ở 800 tok cả ba đều cụt JSON, đo 09/08) nên phải truyền tường minh kèm maxTokens.
        assertThat(GradingEvalService.DEFAULT_MODELS)
                .noneMatch(m -> m.contains("deepseek") || m.contains("kimi") || m.contains("qwen"));
    }

    // ── FW.7: "có điểm nhưng mất nhận xét" là kiểu hỏng phải ĐẾM, không được để MAE che ──────

    @Test
    @DisplayName("bài có điểm nhưng MẤT nhận xét được đếm riêng (JSON cụt), vẫn tính vào MAE")
    void metrics_countsFeedbackMissing() {
        var m = GradingEvalService.computeMetrics(List.of(
                new CaseScore(80, 82, false, 1200L, 250, 249, 300),
                new CaseScore(70, 71, true, 3400L, 250, 249, 800),   // cụt: điểm còn, nhận xét mất
                new CaseScore(60, 63, true, 3300L, 250, 249, 800)));

        assertThat(m.feedbackMissing()).isEqualTo(2);
        // Vẫn đếm graded=3 vì regex fallback đọc được điểm — đúng hành vi prod, và đó chính là lý do
        // phải xem feedbackMissing: MAE của model bị cắt trông vẫn "đẹp".
        assertThat(m.graded()).isEqualTo(3);
    }

    @Test
    @DisplayName("bài chấm fail hoàn toàn KHÔNG bị tính là mất nhận xét (hai kiểu hỏng khác nhau)")
    void metrics_failedIsNotFeedbackMissing() {
        var m = GradingEvalService.computeMetrics(List.of(
                new CaseScore(80, null),
                new CaseScore(70, 70)));

        assertThat(m.failed()).isEqualTo(1);
        assertThat(m.feedbackMissing()).isZero();
    }

    @Test
    @DisplayName("within-10 (1 band) rộng hơn within-5 — lệch 8 điểm đạt band nhưng không đạt 5")
    void metrics_withinTenBand() {
        var m = GradingEvalService.computeMetrics(List.of(
                new CaseScore(80, 88),   // lệch 8: trong band, ngoài 5
                new CaseScore(70, 72),   // lệch 2: cả hai
                new CaseScore(60, 75)));  // lệch 15: ngoài cả hai

        assertThat(m.withinFiveRate()).isEqualTo(0.33);
        assertThat(m.withinTenRate()).isEqualTo(0.67);
    }

    @Test
    @DisplayName("within-10 null khi không bài nào chấm được")
    void metrics_withinTenNullWhenNoneGraded() {
        var m = GradingEvalService.computeMetrics(List.of(new CaseScore(80, null)));
        assertThat(m.withinTenRate()).isNull();
    }

    // ── Phân vị latency ─────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("percentile: p50/p95 theo nearest-rank, danh sách rỗng → null")
    void percentiles() {
        var sorted = List.of(100L, 200L, 300L, 400L, 500L, 600L, 700L, 800L, 900L, 1000L);
        assertThat(GradingEvalService.percentile(sorted, 50)).isEqualTo(500L);
        assertThat(GradingEvalService.percentile(sorted, 95)).isEqualTo(1000L);
        assertThat(GradingEvalService.percentile(List.of(42L), 95)).isEqualTo(42L);
        assertThat(GradingEvalService.percentile(List.of(), 50)).isNull();
        assertThat(GradingEvalService.percentile(null, 50)).isNull();
    }

    // ── CSV cho báo cáo F1.4 ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("CSV mang theo tier + maxTokens ở dòng đầu — kết quả vô nghĩa nếu tách khỏi ngân sách")
    void csvCarriesBudgetHeader() {
        var resp = new GradingEvalResponse(
                List.of(new ModelResult("accounts/fireworks/models/deepseek-v4-flash",
                        4, 0, 3.5, -1.2, 0.75, 1.0, 2, 1200, 6200L, 13900L, 0.0021, 13L, List.of())),
                "accounts/fireworks/models/deepseek-v4-flash", "GRADING_EXAM", 3000);

        String csv = GradingEvalService.toCsv(resp);
        assertThat(csv).startsWith("# tier=GRADING_EXAM maxTokens=3000");
        assertThat(csv).contains("feedbackMissing");
        assertThat(csv).contains("accounts/fireworks/models/deepseek-v4-flash,4,0,3.5,-1.2,0.75,1.0,2,1200,6200,13900,0.0021,13");
    }

    @Test
    @DisplayName("CSV để trống ô null thay vì in 'null'")
    void csvBlanksNulls() {
        var resp = new GradingEvalResponse(
                List.of(new ModelResult("m", 0, 3, null, null, null, null, 0, 0, null, null, 0.0, 0L, List.of())),
                null, "GRADING_DAILY", 1500);

        assertThat(GradingEvalService.toCsv(resp)).contains("m,0,3,,,,,0,0,,,0.0,0");
    }
}
