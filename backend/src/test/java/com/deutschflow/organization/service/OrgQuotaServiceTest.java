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
}
