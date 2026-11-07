package com.deutschflow.user.tour;

import com.deutschflow.common.exception.BadRequestException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Khoá và giới hạn số khoá của hướng dẫn lần đầu, không cần DB. */
class UiTourServiceTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final UiTourService service = new UiTourService(jdbc);

    @Test
    @DisplayName("Khoá hợp lệ: chữ, số, dấu chấm, gạch; tối đa 40 ký tự")
    void keyPattern() {
        assertThat(UiTourService.KEY.matcher("exam.teil-hoeren_2").matches()).isTrue();
        assertThat(UiTourService.KEY.matcher("a".repeat(40)).matches()).isTrue();
        assertThat(UiTourService.KEY.matcher("a".repeat(41)).matches()).isFalse();
        assertThat(UiTourService.KEY.matcher("exam/today").matches()).isFalse();
        assertThat(UiTourService.KEY.matcher("").matches()).isFalse();
        assertThatThrownBy(() -> service.markSeen(7L, "exam today")).isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("Đủ 100 khoá thì từ chối, không ghi thêm")
    void limit() {
        when(jdbc.queryForObject(anyString(), eq(Integer.class), anyLong())).thenReturn(UiTourService.MAX_KEYS);
        assertThatThrownBy(() -> service.markSeen(7L, "exam.today")).isInstanceOf(BadRequestException.class);
        verify(jdbc, never()).update(anyString(), anyLong(), anyString());
    }

    @Test
    @DisplayName("Ghi bằng ON CONFLICT DO NOTHING rồi trả danh sách mới")
    void insertThenList() {
        when(jdbc.queryForObject(anyString(), eq(Integer.class), anyLong())).thenReturn(0);
        when(jdbc.queryForList(anyString(), eq(String.class), anyLong())).thenReturn(List.of("exam.today"));
        assertThat(service.markSeen(7L, "exam.today")).containsExactly("exam.today");
        verify(jdbc).update(contains("ON CONFLICT"), eq(7L), eq("exam.today"));
    }
}
