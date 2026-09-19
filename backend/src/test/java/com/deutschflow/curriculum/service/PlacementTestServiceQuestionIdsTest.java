package com.deutschflow.curriculum.service;

import com.deutschflow.common.exception.BadRequestException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.sql.SQLException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Hồi quy QA simulator 19/09/2026: {@code SELECT * FROM placement_test_sessions} trả cột BIGINT[]
 * {@code question_ids} dưới dạng {@link java.sql.Array} (PgArray), mã cũ chỉ nhận Long[]/Object[] ⇒
 * MỌI lượt nộp bài kiểm tra đầu vào trên prod đều 400 "Invalid test session data".
 */
@DisplayName("PlacementTestService.parseQuestionIds — đọc BIGINT[] bất kể driver trả dạng nào")
class PlacementTestServiceQuestionIdsTest {

    @Test
    @DisplayName("java.sql.Array (đường thật của JdbcTemplate) → long[]")
    void sqlArrayFromDriver() throws SQLException {
        java.sql.Array pg = mock(java.sql.Array.class);
        when(pg.getArray()).thenReturn(new Long[] {7L, 3L, 11L});

        assertThat(PlacementTestService.parseQuestionIds(pg)).containsExactly(7L, 3L, 11L);
    }

    @Test
    @DisplayName("java.sql.Array bọc long[] hoặc Object[] Integer cũng đọc được")
    void sqlArrayOtherShapes() throws SQLException {
        java.sql.Array primitive = mock(java.sql.Array.class);
        when(primitive.getArray()).thenReturn(new long[] {1L, 2L});
        java.sql.Array boxed = mock(java.sql.Array.class);
        when(boxed.getArray()).thenReturn(new Object[] {Integer.valueOf(5), Long.valueOf(6)});

        assertThat(PlacementTestService.parseQuestionIds(primitive)).containsExactly(1L, 2L);
        assertThat(PlacementTestService.parseQuestionIds(boxed)).containsExactly(5L, 6L);
    }

    @Test
    @DisplayName("Long[], Object[], chuỗi literal Postgres \"{1,2,3}\" — các dạng mã cũ từng nhận vẫn nhận")
    void legacyShapes() {
        assertThat(PlacementTestService.parseQuestionIds(new Long[] {4L, 5L})).containsExactly(4L, 5L);
        assertThat(PlacementTestService.parseQuestionIds(new Object[] {8, 9L})).containsExactly(8L, 9L);
        assertThat(PlacementTestService.parseQuestionIds("{10, 20,30}")).containsExactly(10L, 20L, 30L);
    }

    @Test
    @DisplayName("Không đọc được ⇒ 400 với câu người đọc được, không lộ mã máy")
    void unreadableIsBadRequest() throws SQLException {
        java.sql.Array broken = mock(java.sql.Array.class);
        when(broken.getArray()).thenThrow(new SQLException("boom"));

        for (Object bad : new Object[] {null, "", "{}", "{a,b}", 42, new Object[] {"x"}, broken}) {
            assertThatThrownBy(() -> PlacementTestService.parseQuestionIds(bad))
                    .as("raw=%s", bad)
                    .isInstanceOf(BadRequestException.class)
                    .hasMessage("Bài kiểm tra không hợp lệ, hãy tạo bài mới.");
        }
    }
}
