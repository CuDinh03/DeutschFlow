package com.deutschflow.user.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code errors_by_type} và {@code focus_areas} là NOT NULL ở DB. Hibernate chèn null tường minh nên
 * DEFAULT của cột không áp dụng: bản ghi đầu tiên trong ngày của một người học bị từ chối và
 * thống kê phiên nói bị bỏ qua. Builder phải luôn trả giá trị rỗng thay vì null.
 */
@DisplayName("LearningAnalytics.Builder — cột JSON không được null")
class LearningAnalyticsBuilderTest {

    @Test
    @DisplayName("không truyền errorsByType / focusAreas → map và list rỗng")
    void macDinhRong() {
        LearningAnalytics row = LearningAnalytics.builder()
                .userId(14L)
                .analyticsDate(LocalDate.of(2026, 11, 11))
                .build();

        assertThat(row.getErrorsByType()).isNotNull().isEmpty();
        assertThat(row.getFocusAreas()).isNotNull().isEmpty();
    }

    @Test
    @DisplayName("giá trị truyền vào được giữ nguyên")
    void giuGiaTriTruyenVao() {
        LearningAnalytics row = LearningAnalytics.builder()
                .userId(14L)
                .analyticsDate(LocalDate.of(2026, 11, 11))
                .errorsByType(Map.of("ARTICLE", 2))
                .focusAreas(List.of("ARTICLE"))
                .build();

        assertThat(row.getErrorsByType()).containsEntry("ARTICLE", 2);
        assertThat(row.getFocusAreas()).containsExactly("ARTICLE");
    }
}
