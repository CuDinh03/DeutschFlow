package com.deutschflow.gamification.coin.service;

import com.deutschflow.gamification.coin.entity.UserCoinEvent.CoinEventType;
import com.deutschflow.gamification.coin.repository.UserCoinEventRepository;
import com.deutschflow.gamification.coin.repository.UserMockTrialPassRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Unit coverage for {@link CoinService}'s mockable guard logic — the feature flag and the
 * anti-farm short-circuit. The wallet credit/debit and entitlement DB writes are JdbcTemplate /
 * repository heavy and are exercised end-to-end by the {@code *IT} integration tests instead.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("CoinService — guard logic")
class CoinServiceUnitTest {

    @Mock private UserCoinEventRepository coinEventRepository;
    @Mock private UserMockTrialPassRepository trialPassRepository;
    @Mock private JdbcTemplate jdbcTemplate;

    private CoinService coinService;

    @BeforeEach
    void setUp() {
        coinService = new CoinService(coinEventRepository, trialPassRepository, jdbcTemplate);
        setEnabled(true);
    }

    private void setEnabled(boolean value) {
        ReflectionTestUtils.setField(coinService, "enabled", value);
    }

    @Test
    @DisplayName("awardNodeComplete is a no-op and touches nothing when coins are disabled")
    void awardDisabledIsNoOp() {
        setEnabled(false);

        coinService.awardNodeComplete(1L, "node-1", "TREE");

        verifyNoInteractions(coinEventRepository, jdbcTemplate);
    }

    @Test
    @DisplayName("awardNodeComplete does not re-award a node that already earned (anti-farm)")
    void awardOnlyOncePerNode() {
        when(coinEventRepository.existsByUserIdAndRefNodeKindAndRefNodeIdAndEventType(
                1L, "TREE", "node-1", CoinEventType.NODE_COMPLETE)).thenReturn(true);

        coinService.awardNodeComplete(1L, "node-1", "TREE");

        // Ledger row is never written and the wallet is never credited for a repeat completion.
        verify(coinEventRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("hasTrialPassFor short-circuits to false when coins are disabled")
    void hasTrialPassDisabled() {
        setEnabled(false);

        assertThat(coinService.hasTrialPassFor(1L, 9L)).isFalse();
        verifyNoInteractions(trialPassRepository);
    }

    @Test
    @DisplayName("consumeTrialPass returns false when coins are disabled")
    void consumeDisabled() {
        setEnabled(false);

        assertThat(coinService.consumeTrialPass(1L, 9L, 42L)).isFalse();
        verifyNoInteractions(trialPassRepository);
    }

    @Test
    @DisplayName("activeTrialPackIds is empty when coins are disabled")
    void activeTrialPackIdsDisabled() {
        setEnabled(false);

        assertThat(coinService.activeTrialPackIds(1L)).isEmpty();
        verifyNoInteractions(trialPassRepository);
    }
}
