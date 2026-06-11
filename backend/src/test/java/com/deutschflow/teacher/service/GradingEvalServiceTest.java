package com.deutschflow.teacher.service;

import com.deutschflow.teacher.dto.GradingEvalResponse.CaseScore;
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
    @DisplayName("default model list gồm 3 ứng viên free chính")
    void defaultModels() {
        assertThat(GradingEvalService.DEFAULT_MODELS)
                .containsExactly(
                        "llama-3.3-70b-versatile",
                        "meta-llama/llama-4-scout-17b-16e-instruct",
                        "openai/gpt-oss-120b");
    }
}
