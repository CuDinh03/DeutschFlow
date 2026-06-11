package com.deutschflow.marketing.service;

import com.deutschflow.marketing.dto.TeacherClusterDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/** Khoá hành vi gom cụm GV theo trung tâm (D11): clamp minSize ≥ 2 + truyền đúng ngưỡng. */
@ExtendWith(MockitoExtension.class)
class TeacherClusterServiceTest {

    @Mock JdbcTemplate jdbcTemplate;
    @InjectMocks TeacherClusterService service;

    @Test
    @DisplayName("clusters: minSize < 2 bị clamp lên 2 (tránh 'cụm' 1 người)")
    @SuppressWarnings("unchecked")
    void clusters_clampsMinSizeToTwo() {
        List<TeacherClusterDto> rows = List.of(new TeacherClusterDto("Trung tâm ABC", 4, "a@x.com, b@x.com"));
        when(jdbcTemplate.query(anyString(), any(RowMapper.class), eq(2))).thenReturn(rows);

        assertThat(service.clusters(1)).isEqualTo(rows);
    }

    @Test
    @DisplayName("clusters: minSize hợp lệ được truyền nguyên vào HAVING")
    @SuppressWarnings("unchecked")
    void clusters_passesGivenThreshold() {
        when(jdbcTemplate.query(anyString(), any(RowMapper.class), eq(5))).thenReturn(List.of());

        assertThat(service.clusters(5)).isEmpty();
    }
}
