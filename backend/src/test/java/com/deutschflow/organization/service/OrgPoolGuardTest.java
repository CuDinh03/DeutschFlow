package com.deutschflow.organization.service;

import com.deutschflow.common.quota.OrgReservationHolder;
import com.deutschflow.common.quota.QuotaExceededException;
import com.deutschflow.organization.service.OrgQuotaService.OrgReservation;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * H-3: gate giờ GIỮ CHỖ atomic ({@code tryReserve}) thay vì check-then-act. Hợp đồng của guard:
 * empty → 429; metered → suất nằm trong {@link OrgReservationHolder} chờ charge/refund;
 * NONE/unlimited → không đụng holder.
 */
@ExtendWith(MockitoExtension.class)
class OrgPoolGuardTest {

    @Mock
    private OrgQuotaService orgQuotaService;

    @InjectMocks
    private OrgPoolGuard orgPoolGuard;

    @AfterEach
    void clearHolder() {
        OrgReservationHolder.take(); // ThreadLocal — không được rò giữa các test cùng worker thread
    }

    @Test
    @DisplayName("null userId is never gated and never touches the pool")
    void nullUser_noOp() {
        assertThatCode(() -> orgPoolGuard.assertOrgPoolAvailable(null, 2_000L))
                .doesNotThrowAnyException();
        verifyNoInteractions(orgQuotaService);
    }

    @Test
    @DisplayName("B2C / unlimited reservation passes and leaves the holder empty")
    void notMetered_allowed_noHolder() {
        when(orgQuotaService.tryReserve(7L, 2_000L)).thenReturn(Optional.of(OrgReservation.NONE));

        assertThatCode(() -> orgPoolGuard.assertOrgPoolAvailable(7L, 2_000L))
                .doesNotThrowAnyException();
        verify(orgQuotaService).tryReserve(7L, 2_000L);
        assertThat(OrgReservationHolder.take()).isNull();
    }

    @Test
    @DisplayName("metered reservation passes and is parked in the holder for charge/refund")
    void metered_allowed_holderSet() {
        OrgReservation reservation = new OrgReservation(11L, 2_000L);
        when(orgQuotaService.tryReserve(7L, 2_000L)).thenReturn(Optional.of(reservation));

        orgPoolGuard.assertOrgPoolAvailable(7L, 2_000L);

        assertThat(OrgReservationHolder.take()).isEqualTo(reservation);
    }

    @Test
    @DisplayName("throws 429 QuotaExceededException when the pool has no room left")
    void overPool_throws() {
        when(orgQuotaService.tryReserve(7L, 40_000L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> orgPoolGuard.assertOrgPoolAvailable(7L, 40_000L))
                .isInstanceOf(QuotaExceededException.class)
                .hasMessageContaining("ngân sách token AI");
        assertThat(OrgReservationHolder.take()).isNull();
    }

    @Test
    @DisplayName("exhausted-pool exception carries a null snapshot (org-level, not personal)")
    void overPool_nullSnapshot() {
        when(orgQuotaService.tryReserve(7L, 2_000L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> orgPoolGuard.assertOrgPoolAvailable(7L, 2_000L))
                .isInstanceOfSatisfying(QuotaExceededException.class,
                        ex -> assertThat(ex.getSnapshot()).isNull());
    }

    @Test
    @DisplayName("a leftover reservation from an earlier gate in the same request is refunded, not leaked")
    void staleHolderReservation_refundedOnReplace() {
        OrgReservation stale = new OrgReservation(11L, 500L);
        OrgReservationHolder.replace(stale, r -> {
            throw new AssertionError("no previous reservation expected here");
        });
        OrgReservation fresh = new OrgReservation(11L, 2_000L);
        when(orgQuotaService.tryReserve(7L, 2_000L)).thenReturn(Optional.of(fresh));

        orgPoolGuard.assertOrgPoolAvailable(7L, 2_000L);

        verify(orgQuotaService).refund(stale);
        assertThat(OrgReservationHolder.take()).isEqualTo(fresh);
    }
}
