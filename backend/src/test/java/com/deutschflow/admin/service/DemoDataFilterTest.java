package com.deutschflow.admin.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Bảo vệ bộ lọc loại org demo bán hàng (email {@code @deutschflow-demo.com}) khỏi COGS tổng hợp
 * (checklist B2B next-step #3). Khi tắt / không có tài khoản demo → clause rỗng = không đổi hành vi.
 */
@ExtendWith(MockitoExtension.class)
class DemoDataFilterTest {

    private static final String DEMO_DOMAIN = "@deutschflow-demo.com";
    private static final String EXPECTED_QUERY = "SELECT id FROM users WHERE email ILIKE ?";
    private static final String EXPECTED_PATTERN = "%@deutschflow-demo.com";

    @Mock JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("tắt (exclude-demo-data=false) → clause rỗng, KHÔNG truy vấn DB")
    void disabled_returnsEmpty_andSkipsQuery() {
        DemoDataFilter filter = new DemoDataFilter(jdbcTemplate, false, DEMO_DOMAIN);

        assertThat(filter.andExcludeDemo()).isEmpty();
        assertThat(filter.whereExcludeDemo()).isEmpty();
        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    @DisplayName("domain rỗng → clause rỗng, KHÔNG truy vấn DB")
    void blankDomain_returnsEmpty_andSkipsQuery() {
        DemoDataFilter filter = new DemoDataFilter(jdbcTemplate, true, "   ");

        assertThat(filter.andExcludeDemo()).isEmpty();
        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    @DisplayName("không có tài khoản demo → clause rỗng (an toàn không đổi hành vi)")
    void noDemoAccounts_returnsEmpty() {
        when(jdbcTemplate.queryForList(EXPECTED_QUERY, Long.class, EXPECTED_PATTERN))
                .thenReturn(List.of());

        DemoDataFilter filter = new DemoDataFilter(jdbcTemplate, true, DEMO_DOMAIN);

        assertThat(filter.andExcludeDemo()).isEmpty();
        assertThat(filter.whereExcludeDemo()).isEmpty();
    }

    @Test
    @DisplayName("có tài khoản demo → AND clause loại đúng id, vẫn giữ row user_id NULL")
    void demoAccountsPresent_buildsAndClause() {
        when(jdbcTemplate.queryForList(EXPECTED_QUERY, Long.class, EXPECTED_PATTERN))
                .thenReturn(List.of(12L, 13L, 14L));

        DemoDataFilter filter = new DemoDataFilter(jdbcTemplate, true, DEMO_DOMAIN);

        assertThat(filter.andExcludeDemo())
                .isEqualTo(" AND (user_id IS NULL OR user_id NOT IN (12,13,14))");
    }

    @Test
    @DisplayName("có tài khoản demo → WHERE clause cho query all-time (không có WHERE sẵn)")
    void demoAccountsPresent_buildsWhereClause() {
        when(jdbcTemplate.queryForList(EXPECTED_QUERY, Long.class, EXPECTED_PATTERN))
                .thenReturn(List.of(7L));

        DemoDataFilter filter = new DemoDataFilter(jdbcTemplate, true, DEMO_DOMAIN);

        assertThat(filter.whereExcludeDemo())
                .isEqualTo(" WHERE (user_id IS NULL OR user_id NOT IN (7))");
    }

    @Test
    @DisplayName("domain được trim trước khi tạo pattern ILIKE")
    void trimsDomainBeforeBuildingPattern() {
        when(jdbcTemplate.queryForList(EXPECTED_QUERY, Long.class, EXPECTED_PATTERN))
                .thenReturn(List.of(5L));

        DemoDataFilter filter = new DemoDataFilter(jdbcTemplate, true, "  @deutschflow-demo.com  ");

        // Khớp được nghĩa là pattern = "%@deutschflow-demo.com" (đã trim) đúng như EXPECTED_PATTERN.
        assertThat(filter.andExcludeDemo())
                .isEqualTo(" AND (user_id IS NULL OR user_id NOT IN (5))");
    }
}
