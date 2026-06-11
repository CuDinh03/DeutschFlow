package com.deutschflow.common.quota;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Unit tests cho phần quyết định thuần của {@link FreeTierGuard} (phần JDBC mỏng, không test ở đây —
 * theo cùng pattern với OrgQuotaServiceTest).
 */
class FreeTierGuardTest {

    private FreeTierGuard guard() {
        return new FreeTierGuard(mock(JdbcTemplate.class), 2, 5);
    }

    @Test
    @DisplayName("cap chỉ áp cho GV tự do (có user, không thuộc org)")
    void appliesTo() {
        assertThat(FreeTierGuard.appliesTo(7L, null)).isTrue();   // GV tự do
        assertThat(FreeTierGuard.appliesTo(7L, 3L)).isFalse();    // thuộc org → org pool quản
        assertThat(FreeTierGuard.appliesTo(null, null)).isFalse(); // không có user
    }

    @Test
    @DisplayName("overLimit: đạt hoặc vượt hạn mức")
    void overLimit() {
        assertThat(FreeTierGuard.overLimit(1, 2)).isFalse();
        assertThat(FreeTierGuard.overLimit(2, 2)).isTrue();
        assertThat(FreeTierGuard.overLimit(3, 2)).isTrue();
    }

    @Test
    @DisplayName("dailyLimit map đúng theo feature; feature lạ → không giới hạn")
    void dailyLimit() {
        var g = guard();
        assertThat(g.dailyLimit(FreeTierGuard.FEATURE_PPTX)).isEqualTo(2);
        assertThat(g.dailyLimit(FreeTierGuard.FEATURE_OCR_GRADE)).isEqualTo(5);
        assertThat(g.dailyLimit("UNKNOWN")).isEqualTo(Integer.MAX_VALUE);
    }

    @Test
    @DisplayName("secondsToUtcMidnight luôn dương và trong khoảng 1 ngày")
    void secondsToMidnight() {
        int s = FreeTierGuard.secondsToUtcMidnight();
        assertThat(s).isGreaterThanOrEqualTo(60).isLessThanOrEqualTo(86_400);
    }
}
