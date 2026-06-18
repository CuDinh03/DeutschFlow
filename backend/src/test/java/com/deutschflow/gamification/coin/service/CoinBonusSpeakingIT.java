package com.deutschflow.gamification.coin.service;

import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Coin spend on AI speaking: buying a bonus session adds a one-day token top-up to a FREE learner's
 * spendable quota (the {@link QuotaService} integration), without changing their tier. Self-skips
 * without Postgres.
 */
@SpringBootTest(properties = "app.coins.enabled=true")
@DisplayName("coin spend — bonus AI-speaking tokens lift today's FREE quota")
class CoinBonusSpeakingIT extends AbstractPostgresIntegrationTest {

    @Autowired private CoinService coinService;
    @Autowired private QuotaService quotaService;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    private Long uid;

    @BeforeEach
    void seed() {
        User u = userRepository.save(User.builder()
                .email("coin-bonus-" + System.nanoTime() + "@local.test")
                .passwordHash("x")
                .displayName("Bonus Speaker")
                .role(User.Role.STUDENT)
                .build());
        uid = u.getId();
        // Active FREE subscription → daily_token_grant = 50,000 (V42 seed).
        jdbcTemplate.update(
                "INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at) "
                        + "VALUES (?, 'FREE', 'ACTIVE', now(), now() + interval '7 days')",
                uid);
        // Coins to spend.
        jdbcTemplate.update("INSERT INTO user_coin_wallets (user_id, balance) VALUES (?, 50)", uid);
    }

    @Test
    @DisplayName("buying a bonus session raises remaining spendable by the top-up amount")
    void bonusRaisesRemaining() {
        Instant now = Instant.now();
        long before = quotaService.getSnapshotReadOnly(uid, now).remainingSpendable();
        assertThat(before).isPositive(); // full FREE daily grant available

        coinService.purchaseBonusSpeakingSession(uid);

        long after = quotaService.getSnapshotReadOnly(uid, now).remainingSpendable();
        assertThat(after - before).isEqualTo(CoinService.BONUS_SPEAKING_TOKENS);
        // Coins were debited; tier is unchanged (still FREE/DEFAULT).
        assertThat(coinService.getBalance(uid).balance()).isEqualTo(50 - CoinService.PRICE_BONUS_SPEAKING);
        assertThat(coinService.bonusSpeakingTokensToday(uid)).isEqualTo(CoinService.BONUS_SPEAKING_TOKENS);
    }
}
