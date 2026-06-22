package com.deutschflow.teacher.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Ràng buộc thang điểm 0–10 cho phiếu đánh giá (chặn data 0–100 lẫn vào DB từ phía app,
 * song hành với CHECK chk_class_students_skill_range ở V232).
 */
class StudentEvaluationRequestTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void init() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void close() {
        factory.close();
    }

    @Test
    @DisplayName("điểm hợp lệ 0–10 (kể cả biên 0.0 và 10.0) không vi phạm")
    void validScores_noViolations() {
        var req = new StudentEvaluationRequest("Học tốt", bd(0.0), bd(5.5), bd(10.0), bd(7.5));
        assertThat(validator.validate(req)).isEmpty();
    }

    @Test
    @DisplayName("toàn bộ skill null vẫn hợp lệ (cho phép đánh giá một phần)")
    void allNull_noViolations() {
        var req = new StudentEvaluationRequest(null, null, null, null, null);
        assertThat(validator.validate(req)).isEmpty();
    }

    @Test
    @DisplayName("giá trị thang 0–100 (>10) bị từ chối")
    void overTen_rejected() {
        var req = new StudentEvaluationRequest(null, bd(62.0), null, null, null);
        assertThat(validator.validate(req))
                .anyMatch(v -> v.getPropertyPath().toString().equals("skillHoren"));
    }

    @Test
    @DisplayName("giá trị âm bị từ chối")
    void negative_rejected() {
        var req = new StudentEvaluationRequest(null, null, bd(-1.0), null, null);
        assertThat(validator.validate(req))
                .anyMatch(v -> v.getPropertyPath().toString().equals("skillLesen"));
    }

    @Test
    @DisplayName("quá 1 chữ số thập phân bị từ chối")
    void tooManyDecimals_rejected() {
        var req = new StudentEvaluationRequest(null, null, null, bd(7.55), null);
        assertThat(validator.validate(req))
                .anyMatch(v -> v.getPropertyPath().toString().equals("skillSchreiben"));
    }

    private static BigDecimal bd(double v) {
        return BigDecimal.valueOf(v);
    }
}
