package com.deutschflow.gamification.coin.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.InsufficientCoinsException;
import com.deutschflow.grammar.dto.MockExamPackDto;
import com.deutschflow.grammar.service.MockExamPackService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Coin spend on mock exams: buy a single-attempt trial pass on a PRO pack, then it re-locks after the
 * attempt is consumed. PRO subscription is untouched (these users are FREE/DEFAULT). Self-skips
 * without Postgres.
 */
@SpringBootTest(properties = "app.coins.enabled=true")
@DisplayName("coin spend — mock-exam trial pass (bonus-only, relocks)")
class CoinSpendMockTrialIT extends AbstractPostgresIntegrationTest {

    @Autowired private CoinService coinService;
    @Autowired private MockExamPackService mockExamPackService;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    private Long uid;
    private Long packId;

    @BeforeEach
    void seed() {
        User u = userRepository.save(User.builder()
                .email("coin-spend-" + System.nanoTime() + "@local.test")
                .passwordHash("x")
                .displayName("Coin Spender")
                .role(User.Role.STUDENT)
                .build());
        uid = u.getId();
        packId = jdbcTemplate.queryForObject(
                "INSERT INTO mock_exam_packs (title, cefr_level, exam_format, requires_paid, is_active, sort_order) "
                        + "VALUES (?, ?, ?, TRUE, TRUE, 0) RETURNING id",
                Long.class, "Trial Pack B1 " + System.nanoTime(), "B1", "GOETHE");
    }

    private void creditCoins(long amount) {
        jdbcTemplate.update(
                "INSERT INTO user_coin_wallets (user_id, balance) VALUES (?, ?) "
                        + "ON CONFLICT (user_id) DO UPDATE SET balance = ?",
                uid, amount, amount);
    }

    @Test
    @DisplayName("purchase unlocks one attempt; consuming the pass re-locks the pack")
    void purchaseConsumeRelock() {
        creditCoins(10);

        // Locked before purchase (FREE user, paid pack, no pass).
        assertThatThrownBy(() -> mockExamPackService.getPack(uid, packId))
                .isInstanceOf(ForbiddenException.class);

        coinService.purchaseTrialPass(uid, packId);
        assertThat(coinService.getBalance(uid).balance())
                .isEqualTo(10 - CoinService.PRICE_MOCK_TRIAL_PASS);
        assertThat(coinService.hasTrialPassFor(uid, packId)).isTrue();

        // Now viewable, and the catalog reports it unlocked.
        org.assertj.core.api.Assertions.assertThatCode(() -> mockExamPackService.getPack(uid, packId))
                .doesNotThrowAnyException();
        MockExamPackDto listed = mockExamPackService.listPacks(uid).stream()
                .filter(p -> p.id().equals(packId)).findFirst().orElseThrow();
        assertThat(listed.locked()).isFalse();

        // Consume the pass (as the exam-start does) → pack re-locks.
        assertThat(coinService.consumeTrialPass(uid, packId, 999L)).isTrue();
        assertThat(coinService.hasTrialPassFor(uid, packId)).isFalse();
        assertThatThrownBy(() -> mockExamPackService.getPack(uid, packId))
                .isInstanceOf(ForbiddenException.class);

        // A second pass can be bought with the remaining coins; consuming used no coins.
        coinService.purchaseTrialPass(uid, packId);
        assertThat(coinService.getBalance(uid).balance())
                .isEqualTo(10 - 2 * CoinService.PRICE_MOCK_TRIAL_PASS);
    }

    @Test
    @DisplayName("purchase with insufficient balance throws and grants no pass")
    void insufficientBalanceThrows() {
        // No coins credited.
        assertThatThrownBy(() -> coinService.purchaseTrialPass(uid, packId))
                .isInstanceOf(InsufficientCoinsException.class);
        assertThat(coinService.hasTrialPassFor(uid, packId)).isFalse();
        assertThat(coinService.getBalance(uid).balance()).isZero();
    }

    @Test
    @DisplayName("buying a second active pass for the same pack is rejected")
    void noDuplicateActivePass() {
        creditCoins(20);
        coinService.purchaseTrialPass(uid, packId);
        assertThatThrownBy(() -> coinService.purchaseTrialPass(uid, packId))
                .isInstanceOf(com.deutschflow.common.exception.ConflictException.class);
    }
}
