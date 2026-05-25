package com.deutschflow.common.quota;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Covers VN calendar daily usage sums, rollover wallet caps, paid downgrade when balance hits 0,
 * and INTERNAL exemption. {@link QuotaService} uses {@code REQUIRES_NEW} on reads — no outer test
 * {@code @Transactional}; users are deleted explicitly.
 */
@SpringBootTest
class QuotaBillingIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private QuotaService quotaService;

    @Autowired
    private AiUsageLedgerService aiUsageLedgerService;

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("DELETE FROM ai_token_usage_events WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'quota-it-%')");
        jdbcTemplate.update("DELETE FROM user_ai_token_wallets WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'quota-it-%')");
        jdbcTemplate.update("DELETE FROM user_subscriptions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'quota-it-%')");
        jdbcTemplate.update("DELETE FROM users WHERE email LIKE 'quota-it-%'");
    }

    @Test
    void usedToday_countsOnlyLedgerWithinVNCalendarDay_excludesYesterday() {
        User u = userRepository.save(User.builder()
                .email("quota-it-vnday@test.com")
                .passwordHash("$2a$10$h")
                .displayName("QVN")
                .role(User.Role.STUDENT)
                .build());
        userRepository.flush();

        Instant nowMidDay = Instant.parse("2026-05-15T06:30:00+07:00");
        Instant yesterday = Instant.parse("2026-05-14T06:30:00+07:00");
        Instant insideToday = Instant.parse("2026-05-15T02:00:00+07:00");

        insertSubscription(u.getId(), "FREE",
                Timestamp.from(Instant.parse("2026-05-01T00:00:00Z")),
                Timestamp.from(Instant.parse("2027-01-01T00:00:00Z")));

        jdbcTemplate.update("""
                        INSERT INTO ai_token_usage_events (
                          user_id, provider, model, prompt_tokens, completion_tokens, total_tokens,
                          feature, request_id, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                u.getId(), "t", "m", 0, 9000, 9000, "TEST", null, Timestamp.from(yesterday));

        jdbcTemplate.update("""
                        INSERT INTO ai_token_usage_events (
                          user_id, provider, model, prompt_tokens, completion_tokens, total_tokens,
                          feature, request_id, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                u.getId(), "t", "m", 0, 1000, 1000, "TEST", null, Timestamp.from(insideToday));

        QuotaSnapshot snap = quotaService.getSnapshot(u.getId(), nowMidDay);
        assertThat(snap.usedToday()).isEqualTo(1000L);
    }

    @Test
    void free_dailyRemaining_enforcedAgainstEstimatedSpend() {
        User u = userRepository.save(User.builder()
                .email("quota-it-free@test.com")
                .passwordHash("$2a$10$h")
                .displayName("QFREE")
                .role(User.Role.STUDENT)
                .build());
        userRepository.flush();

        Instant nowMidDay = Instant.parse("2026-05-15T06:30:00+07:00");
        Instant insideToday = Instant.parse("2026-05-15T02:00:00+07:00");

        insertSubscription(u.getId(), "FREE",
                Timestamp.from(Instant.parse("2026-05-01T00:00:00Z")),
                Timestamp.from(Instant.parse("2027-01-01T00:00:00Z")));

        jdbcTemplate.update("""
                        INSERT INTO ai_token_usage_events (
                          user_id, provider, model, prompt_tokens, completion_tokens, total_tokens,
                          feature, request_id, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                u.getId(), "t", "m", 0, 8000, 8000, "TEST", null, Timestamp.from(insideToday));

        assertThatThrownBy(() -> quotaService.assertAllowed(u.getId(), nowMidDay, 1001L))
                .isInstanceOf(QuotaExceededException.class);
        assertThat(quotaService.assertAllowed(u.getId(), nowMidDay, 1000L).remainingSpendable())
                .isEqualTo(1000L);
    }

    @Test
    void walletAccrual_neverExceedsThirtyDailyGrants_evenAfterLongElapsedPeriod() {
        User u = userRepository.save(User.builder()
                .email("quota-it-cap@test.com")
                .passwordHash("$2a$10$h")
                .displayName("QCAP")
                .role(User.Role.STUDENT)
                .build());
        userRepository.flush();

        Instant now = Instant.parse("2026-05-31T08:00:00+07:00");
        insertSubscription(u.getId(), "PRO",
                Timestamp.from(Instant.parse("2026-01-01T00:00:00Z")), null);

        jdbcTemplate.update("""
                        INSERT INTO user_ai_token_wallets (user_id, balance, last_accrual_local_date)
                        VALUES (?, ?, NULL)
                        """, u.getId(), 0L);

        QuotaSnapshot snap = quotaService.getSnapshot(u.getId(), now);
        long cap = 400_000L * 30;
        assertThat(snap.walletCap()).isEqualTo(cap);
        assertThat(snap.walletBalance()).isEqualTo(cap);
    }

    @Test
    void ledgerDebit_zeroWallet_downgradesPaidToDefault() {
        User u = userRepository.save(User.builder()
                .email("quota-it-down@test.com")
                .passwordHash("$2a$10$h")
                .displayName("QDWN")
                .role(User.Role.STUDENT)
                .build());
        userRepository.flush();

        Instant now = Instant.now();
        insertSubscription(u.getId(), "ULTRA",
                Timestamp.from(now.minusSeconds(86400)), null);

        LocalDate vnToday = QuotaVnCalendar.localDateOf(now);
        jdbcTemplate.update("""
                        INSERT INTO user_ai_token_wallets (user_id, balance, last_accrual_local_date)
                        VALUES (?, ?, ?)
                        """, u.getId(), 50L, Date.valueOf(vnToday));

        aiUsageLedgerService.record(u.getId(), "x", "m",
                0, 51, 51, "TEST", null, null);

        Integer activeUltra = jdbcTemplate.queryForObject("""
                        SELECT COUNT(*) FROM user_subscriptions
                        WHERE user_id = ? AND status = 'ACTIVE' AND plan_code = 'ULTRA'
                        """, Integer.class, u.getId());
        Integer activeDefault = jdbcTemplate.queryForObject("""
                        SELECT COUNT(*) FROM user_subscriptions
                        WHERE user_id = ? AND status = 'ACTIVE' AND plan_code = 'DEFAULT'
                        """, Integer.class, u.getId());
        assertThat(activeUltra).isZero();
        assertThat(activeDefault).isEqualTo(1);

        Integer walletRows = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_ai_token_wallets WHERE user_id = ?", Integer.class, u.getId());
        assertThat(walletRows).isZero();
    }

    @Test
    void internalPlan_isUnlimitedAndSkipsWalletDebitOnUsage() {
        User u = userRepository.save(User.builder()
                .email("quota-it-int@test.com")
                .passwordHash("$2a$10$h")
                .displayName("QINT")
                .role(User.Role.STUDENT)
                .build());
        userRepository.flush();

        Instant now = Instant.now();
        insertSubscription(u.getId(), "INTERNAL",
                Timestamp.from(now.minusSeconds(86400)), null);

        QuotaSnapshot snap = quotaService.getSnapshot(u.getId(), now);
        assertThat(snap.unlimitedInternal()).isTrue();
        QuotaSnapshot allowed = quotaService.assertAllowed(u.getId(), now, 1_000_000L);
        assertThat(allowed.remainingSpendable()).isGreaterThan(1_000_000L);

        aiUsageLedgerService.record(u.getId(), "x", "m",
                0, 5000, 5000, "TEST", null, null);

        Integer walletRows = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_ai_token_wallets WHERE user_id = ?", Integer.class, u.getId());
        assertThat(walletRows).isZero();
        assertThat(quotaService.resolvePlanBadge(u.getId(), now).planCode()).isEqualTo("INTERNAL");
    }

    private void insertSubscription(Long userId, String planCode, Timestamp startsAt, Timestamp endsAt) {
        jdbcTemplate.update("""
                        INSERT INTO user_subscriptions (
                          user_id, plan_code, status, starts_at, ends_at
                        ) VALUES (?, ?, 'ACTIVE', ?, ?)
                        """,
                userId, planCode, startsAt, endsAt);
    }
}
