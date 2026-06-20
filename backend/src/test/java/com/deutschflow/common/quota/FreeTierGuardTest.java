package com.deutschflow.common.quota;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;

import java.sql.ResultSet;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Unit tests cho phần quyết định thuần của {@link FreeTierGuard} (phần JDBC mỏng, không test ở đây —
 * theo cùng pattern với OrgQuotaServiceTest).
 */
class FreeTierGuardTest {

    private FreeTierGuard guard() {
        return new FreeTierGuard(mock(JdbcTemplate.class), 2, 5);
    }

    /** Guard có jdbcTemplate trả về (pool, unlimited) cho query org. */
    private FreeTierGuard guardWithOrg(long pool, boolean unlimited) throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ResultSet rs = mock(ResultSet.class);
        when(rs.next()).thenReturn(true);
        when(rs.getLong(1)).thenReturn(pool);
        when(rs.getBoolean(2)).thenReturn(unlimited);
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), any()))
                .thenAnswer(inv -> ((ResultSetExtractor<?>) inv.getArgument(1)).extractData(rs));
        return new FreeTierGuard(jdbc, 2, 5);
    }

    @Test
    @DisplayName("M-5 orgMemberCapped: pool=0 & !unlimited → cap (đóng backdoor); unlimited hoặc pool>0 → không")
    void orgMemberCapped_decisionTable() {
        assertThat(FreeTierGuard.orgMemberCapped(0L, false)).isTrue();    // pool=0 chưa unlimited → cap
        assertThat(FreeTierGuard.orgMemberCapped(0L, true)).isFalse();    // unlimited tường minh
        assertThat(FreeTierGuard.orgMemberCapped(500L, false)).isFalse(); // pool>0 → metered bởi OrgPoolGuard
        assertThat(FreeTierGuard.orgMemberCapped(500L, true)).isFalse();  // unlimited thắng
    }

    @Test
    @DisplayName("appliesTo: GV B2C → cap; user null → không (nhánh không chạm DB)")
    void appliesTo_nonOrgAndNullUser() throws Exception {
        FreeTierGuard g = guardWithOrg(0L, false);
        assertThat(g.appliesTo(7L, null)).isTrue();    // GV B2C tự do
        assertThat(g.appliesTo(null, null)).isFalse(); // không có user
    }

    @Test
    @DisplayName("appliesTo: org member pool=0 & !unlimited → cap (regression cho backdoor M-5)")
    void appliesTo_orgMemberPoolZero_capped() throws Exception {
        assertThat(guardWithOrg(0L, false).appliesTo(7L, 3L)).isTrue();
    }

    @Test
    @DisplayName("appliesTo: org member unlimited → không cap; org member pool>0 → không cap (metered)")
    void appliesTo_orgMemberUnlimitedOrMetered_notCapped() throws Exception {
        assertThat(guardWithOrg(0L, true).appliesTo(7L, 3L)).isFalse();    // unlimited
        assertThat(guardWithOrg(500L, false).appliesTo(7L, 3L)).isFalse(); // metered bởi org pool
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
