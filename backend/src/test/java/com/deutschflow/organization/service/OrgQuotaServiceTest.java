package com.deutschflow.organization.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for the pure org-pool decision used by {@code QuotaService.assertAllowed}.
 * The JDBC plumbing of {@link OrgQuotaService#wouldExceedOrgPool} is thin; the branching
 * logic lives in the pure {@link OrgQuotaService#exceeds} method tested exhaustively here.
 */
class OrgQuotaServiceTest {

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
}
