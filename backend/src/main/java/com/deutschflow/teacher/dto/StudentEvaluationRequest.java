package com.deutschflow.teacher.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;

import java.math.BigDecimal;

/**
 * Phiếu đánh giá học viên (teacher → student/class).
 *
 * <p>Điểm 4 kỹ năng theo thang <b>0–10</b> (NUMERIC(4,1) ở DB; khớp CHECK
 * {@code chk_class_students_skill_range} của V232 và ngưỡng đậu/cert ≥ 5.0 trong
 * {@code StudentEvaluationService}). Mọi cột nullable: cho phép lưu đánh giá một phần —
 * ràng buộc dải chỉ áp dụng khi có giá trị (constraint Bean Validation pass trên null).
 */
public record StudentEvaluationRequest(
        String teacherComment,

        @DecimalMin(value = "0.0", message = "skillHoren must be between 0 and 10")
        @DecimalMax(value = "10.0", message = "skillHoren must be between 0 and 10")
        @Digits(integer = 2, fraction = 1, message = "skillHoren must have at most 1 decimal place")
        BigDecimal skillHoren,

        @DecimalMin(value = "0.0", message = "skillLesen must be between 0 and 10")
        @DecimalMax(value = "10.0", message = "skillLesen must be between 0 and 10")
        @Digits(integer = 2, fraction = 1, message = "skillLesen must have at most 1 decimal place")
        BigDecimal skillLesen,

        @DecimalMin(value = "0.0", message = "skillSchreiben must be between 0 and 10")
        @DecimalMax(value = "10.0", message = "skillSchreiben must be between 0 and 10")
        @Digits(integer = 2, fraction = 1, message = "skillSchreiben must have at most 1 decimal place")
        BigDecimal skillSchreiben,

        @DecimalMin(value = "0.0", message = "skillSprechen must be between 0 and 10")
        @DecimalMax(value = "10.0", message = "skillSprechen must be between 0 and 10")
        @Digits(integer = 2, fraction = 1, message = "skillSprechen must have at most 1 decimal place")
        BigDecimal skillSprechen
) {}
