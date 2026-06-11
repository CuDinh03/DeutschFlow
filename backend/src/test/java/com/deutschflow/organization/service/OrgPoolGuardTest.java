package com.deutschflow.organization.service;

import com.deutschflow.common.quota.QuotaExceededException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrgPoolGuardTest {

    @Mock
    private OrgQuotaService orgQuotaService;

    @InjectMocks
    private OrgPoolGuard orgPoolGuard;

    @Test
    @DisplayName("null userId is never gated and never queries the pool")
    void nullUser_noOp() {
        assertThatCode(() -> orgPoolGuard.assertOrgPoolAvailable(null, 2_000L))
                .doesNotThrowAnyException();
        verifyNoInteractions(orgQuotaService);
    }

    @Test
    @DisplayName("passes when org pool is not exceeded")
    void underPool_allowed() {
        when(orgQuotaService.wouldExceedOrgPool(7L, 2_000L)).thenReturn(false);

        assertThatCode(() -> orgPoolGuard.assertOrgPoolAvailable(7L, 2_000L))
                .doesNotThrowAnyException();
        verify(orgQuotaService).wouldExceedOrgPool(7L, 2_000L);
    }

    @Test
    @DisplayName("throws 429 QuotaExceededException when org pool is exhausted")
    void overPool_throws() {
        when(orgQuotaService.wouldExceedOrgPool(7L, 40_000L)).thenReturn(true);

        assertThatThrownBy(() -> orgPoolGuard.assertOrgPoolAvailable(7L, 40_000L))
                .isInstanceOf(QuotaExceededException.class)
                .hasMessageContaining("ngân sách token AI");
    }

    @Test
    @DisplayName("exhausted-pool exception carries a null snapshot (org-level, not personal)")
    void overPool_nullSnapshot() {
        when(orgQuotaService.wouldExceedOrgPool(7L, 2_000L)).thenReturn(true);

        try {
            orgPoolGuard.assertOrgPoolAvailable(7L, 2_000L);
        } catch (QuotaExceededException ex) {
            assertThat(ex.getSnapshot()).isNull();
            return;
        }
        // unreachable — the call above must throw
        verify(orgQuotaService, never()).monthlyPool(7L);
    }
}
