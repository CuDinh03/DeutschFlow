package com.deutschflow.organization.service;

import com.deutschflow.common.exception.OrgReadOnlyException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the pure org-pool decision helpers. Since H-3 the enforcement itself lives in
 * {@link OrgQuotaService#tryReserve} (atomic conditional-upsert, covered by
 * {@code OrgPoolReserveConcurrencyIntegrationTest} against real Postgres); the pure branching helpers
 * ({@link OrgQuotaService#exceeds}, {@code poolBlocks}, {@code usagePercent}) stay tested here.
 */
class OrgQuotaServiceTest {

    /**
     * Nhánh AI đọc giấy phép bằng JDBC chứ không qua entity, nên nó phải TỰ lấy đủ ba mảnh —
     * {@code status}, {@code valid_until} VÀ mốc neo {@code suspended_at}.
     *
     * <p>Vì sao phải chốt bằng câu SQL và bằng chính lời gọi đọc cột: thiếu {@code suspended_at}
     * thì {@code OrgLicenseState.evaluate} nhận {@code null}, mọi trung tâm bị đình chỉ rơi thẳng
     * xuống {@code CUT} thay vì {@code READ_ONLY} — mà hai mức đó CÙNG ném {@code ORG_READ_ONLY},
     * nên không một ca test hành vi nào ở nhánh này nhìn thấy sai lệch. Đây là chỗ duy nhất bắt
     * được việc bỏ sót cột.
     */
    @Test
    @DisplayName("nhánh AI (JDBC) phải lấy CẢ suspended_at, không chỉ status + valid_until")
    @SuppressWarnings("unchecked")
    void loadPoolConfig_mustCarrySuspensionAnchor() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        OrgQuotaService service = new OrgQuotaService(jdbc);

        ResultSet rs = mock(ResultSet.class);
        when(rs.next()).thenReturn(true);
        when(rs.getLong(1)).thenReturn(100_000L);
        when(rs.getBoolean(2)).thenReturn(false);
        when(rs.getString(3)).thenReturn("SUSPENDED");
        when(rs.getTimestamp(4)).thenReturn(null);
        when(rs.getTimestamp(5))
                .thenReturn(Timestamp.from(Instant.now().minus(3, ChronoUnit.DAYS)));

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        when(jdbc.query(sql.capture(), any(ResultSetExtractor.class), any(Object[].class)))
                .thenAnswer(inv -> ((ResultSetExtractor<Object>) inv.getArgument(1)).extractData(rs));

        assertThatThrownBy(() -> service.tryReserveForOrg(7L, 500))
                .isInstanceOf(OrgReadOnlyException.class);

        assertThat(sql.getAllValues()).anyMatch(q -> q.contains("suspended_at"));
        verify(rs).getTimestamp(5);
    }

    @Test
    @DisplayName("non-org user (null orgId) is never gated")
    void exceeds_nullOrg_false() {
        assertThat(OrgQuotaService.exceeds(null, 1_000L, 999_999L, 10_000L)).isFalse();
    }

    @Test
    @DisplayName("pool <= 0 means unlimited — never gated")
    void exceeds_unlimitedPool_false() {
        assertThat(OrgQuotaService.exceeds(7L, 0L, 5_000_000L, 1_000L)).isFalse();
        assertThat(OrgQuotaService.exceeds(7L, -1L, 5_000_000L, 1_000L)).isFalse();
    }

    @Test
    @DisplayName("usage + estimate below pool is allowed")
    void exceeds_belowPool_false() {
        assertThat(OrgQuotaService.exceeds(7L, 1_000L, 500L, 400L)).isFalse();
    }

    @Test
    @DisplayName("usage + estimate exactly at pool is allowed (only strictly over is gated)")
    void exceeds_atPool_false() {
        assertThat(OrgQuotaService.exceeds(7L, 1_000L, 600L, 400L)).isFalse();
    }

    @Test
    @DisplayName("usage + estimate over pool is gated")
    void exceeds_overPool_true() {
        assertThat(OrgQuotaService.exceeds(7L, 1_000L, 600L, 401L)).isTrue();
        assertThat(OrgQuotaService.exceeds(7L, 1_000L, 1_001L, 0L)).isTrue();
    }

    @Test
    @DisplayName("negative estimate is clamped to zero")
    void exceeds_negativeEstimate_clamped() {
        assertThat(OrgQuotaService.exceeds(7L, 1_000L, 1_000L, -50L)).isFalse();
        assertThat(OrgQuotaService.exceeds(7L, 1_000L, 1_001L, -50L)).isTrue();
    }

    @Test
    @DisplayName("usagePercent: unlimited pool (<=0) is always 0%")
    void usagePercent_unlimitedPool_zero() {
        assertThat(OrgQuotaService.usagePercent(0L, 999_999L)).isZero();
        assertThat(OrgQuotaService.usagePercent(-1L, 999_999L)).isZero();
    }

    @Test
    @DisplayName("usagePercent: computes floored percentage of pool used")
    void usagePercent_computesFloor() {
        assertThat(OrgQuotaService.usagePercent(1_000L, 0L)).isZero();
        assertThat(OrgQuotaService.usagePercent(1_000L, 799L)).isEqualTo(79);
        assertThat(OrgQuotaService.usagePercent(1_000L, 800L)).isEqualTo(80);
        assertThat(OrgQuotaService.usagePercent(1_000L, 1_000L)).isEqualTo(100);
    }

    @Test
    @DisplayName("usagePercent: can exceed 100 when over pool, negative used clamped to 0")
    void usagePercent_overAndNegative() {
        assertThat(OrgQuotaService.usagePercent(1_000L, 1_500L)).isEqualTo(150);
        assertThat(OrgQuotaService.usagePercent(1_000L, -50L)).isZero();
    }

    @Test
    @DisplayName("POOL_ALERT_PERCENT threshold is 80")
    void poolAlertPercent_is80() {
        assertThat(OrgQuotaService.POOL_ALERT_PERCENT).isEqualTo(80);
    }

    // --- P-14: full V237 decision table (pool_unlimited honored) ---

    @Test
    @DisplayName("poolBlocks: pool_unlimited=true → never blocks, regardless of pool/usage")
    void poolBlocks_unlimited_false() {
        assertThat(OrgQuotaService.poolBlocks(0L, true, 0L, 100_000L)).isFalse();
        assertThat(OrgQuotaService.poolBlocks(1_000L, true, 5_000L, 100L)).isFalse();
    }

    @Test
    @DisplayName("poolBlocks: pool=0 & !unlimited → caps any positive consumption (closes M-5/P-14 backdoor)")
    void poolBlocks_unconfigured_caps() {
        assertThat(OrgQuotaService.poolBlocks(0L, false, 0L, 1L)).isTrue();
        assertThat(OrgQuotaService.poolBlocks(0L, false, 0L, 0L)).isFalse();   // no-op request, no charge
        assertThat(OrgQuotaService.poolBlocks(0L, false, 0L, -5L)).isFalse();  // negative estimate clamped
    }

    @Test
    @DisplayName("poolBlocks: pool>0 & !unlimited → metered (only strictly over pool is blocked)")
    void poolBlocks_metered() {
        assertThat(OrgQuotaService.poolBlocks(1_000L, false, 600L, 400L)).isFalse(); // exactly at pool
        assertThat(OrgQuotaService.poolBlocks(1_000L, false, 600L, 401L)).isTrue();  // over pool
    }

    // --- 2 kênh token (26/07): ranh giới duy nhất là org_members.role ---

    @Test
    @DisplayName("OrgMembership.staff(): OWNER/MANAGER/TEACHER là kênh trung tâm, STUDENT là kênh ví cá nhân")
    void membership_staffBoundary() {
        assertThat(new OrgQuotaService.OrgMembership(7L, "OWNER").staff()).isTrue();
        assertThat(new OrgQuotaService.OrgMembership(7L, "MANAGER").staff()).isTrue();
        assertThat(new OrgQuotaService.OrgMembership(7L, "TEACHER").staff()).isTrue();
        assertThat(new OrgQuotaService.OrgMembership(7L, "STUDENT").staff()).isFalse();
        // Role lạ/di sản (vd 'ADMIN' trước V225) nghiêng về kênh trung tâm — an toàn: không bao giờ
        // cấp nhầm pool cho học viên, và staff không bị rơi về ví cá nhân.
        assertThat(new OrgQuotaService.OrgMembership(7L, "ADMIN").staff()).isTrue();
    }
}
