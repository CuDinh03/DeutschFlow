package com.deutschflow.common.quota;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Q2 và Q3 (quyết định owner 28/08) — trial và gói TRẢ PHÍ phải được đối xử khác nhau.
 *
 * <ul>
 *   <li><b>Q2</b> ví cạn GIỮA trial ⇒ KHÔNG hạ gói. Ví cấp theo ngày nên cạn hôm nay là
 *       bình thường; hạ về DEFAULT là kết thúc trial sớm vì một lý do tạm thời.</li>
 *   <li><b>Q3</b> trial hết hạn ⇒ kết thúc HẲN + xoá ví, BẤT KỂ ví còn dư. Grace-drain là
 *       quyền lợi của người đã TRẢ TIỀN — token họ mua là của họ; token trial là quà dùng
 *       thử, không mang sang ngày 8.</li>
 * </ul>
 *
 * <p>Mỗi ca đều có một ca ĐỐI CHỨNG với gói trả phí: nếu không, một bản vá làm hỏng
 * grace-drain của khách hàng trả tiền vẫn xanh.
 */
@SpringBootTest
class TrialLifecycleIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private QuotaService quotaService;

    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("DELETE FROM user_ai_token_wallets WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'trial-it-%')");
        jdbcTemplate.update("DELETE FROM user_subscriptions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'trial-it-%')");
        jdbcTemplate.update("DELETE FROM users WHERE email LIKE 'trial-it-%'");
    }

    private User newUser(String tag) {
        User u = userRepository.save(User.builder()
                .email("trial-it-" + tag + "-" + System.nanoTime() + "@test.com")
                .passwordHash("$2a$10$h").displayName("Trial IT")
                .role(User.Role.STUDENT).build());
        userRepository.flush();
        return u;
    }

    private void insertSub(long userId, String planCode, String source, Instant startsAt, Instant endsAt) {
        jdbcTemplate.update("""
                        INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at, source)
                        VALUES (?, ?, 'ACTIVE', ?, ?, ?)
                        """,
                userId, planCode, Timestamp.from(startsAt), Timestamp.from(endsAt), source);
    }

    /** Ví với số dư cho trước, đã accrue hôm nay để lần debit tới không được nạp thêm. */
    private void insertWallet(long userId, long balance, Instant now) {
        jdbcTemplate.update("""
                        INSERT INTO user_ai_token_wallets (user_id, balance, last_accrual_local_date)
                        VALUES (?, ?, ?)
                        """,
                userId, balance, java.sql.Date.valueOf(LocalDate.ofInstant(now, VN)));
    }

    private String statusOf(long userId, String planCode) {
        return jdbcTemplate.queryForObject(
                "SELECT status FROM user_subscriptions WHERE user_id = ? AND plan_code = ? ORDER BY id DESC LIMIT 1",
                String.class, userId, planCode);
    }

    private int walletRows(long userId) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_ai_token_wallets WHERE user_id = ?", Integer.class, userId);
        return n == null ? 0 : n;
    }

    // ─── Q2 — ví cạn giữa trial ────────────────────────────────────────────────

    @Test
    @DisplayName("Q2: ví cạn giữa trial → gói PRO GIỮ NGUYÊN, ví không bị xoá")
    void trialSurvivesEmptyWallet() {
        Instant now = Instant.now();
        User u = newUser("q2trial");
        insertSub(u.getId(), "PRO", "TRIAL", now.minus(2, ChronoUnit.DAYS), now.plus(5, ChronoUnit.DAYS));
        insertWallet(u.getId(), 0L, now);

        quotaService.applyUsageDebit(u.getId(), 100L, now);

        assertThat(statusOf(u.getId(), "PRO"))
                .as("trial còn 5 ngày — cạn ví hôm nay không phải lý do kết thúc sớm")
                .isEqualTo("ACTIVE");
        assertThat(walletRows(u.getId()))
                .as("ví phải còn để grant ngày mai nạp vào")
                .isEqualTo(1);
    }

    @Test
    @DisplayName("Q2 đối chứng: gói TRẢ PHÍ cạn ví vẫn hạ về DEFAULT như cũ")
    void paidStillDowngradesOnEmptyWallet() {
        Instant now = Instant.now();
        User u = newUser("q2paid");
        insertSub(u.getId(), "PRO", "IAP", now.minus(2, ChronoUnit.DAYS), now.plus(20, ChronoUnit.DAYS));
        insertWallet(u.getId(), 0L, now);

        quotaService.applyUsageDebit(u.getId(), 100L, now);

        // Hành vi có sẵn, không được đổi kèm theo bản vá trial.
        assertThat(statusOf(u.getId(), "PRO")).isEqualTo("ENDED");
        assertThat(statusOf(u.getId(), "DEFAULT")).isEqualTo("ACTIVE");
    }

    // ─── Q3 — trial hết hạn ────────────────────────────────────────────────────

    @Test
    @DisplayName("Q3: trial hết hạn → ENDED + XOÁ ví, kể cả khi ví còn dư")
    void expiredTrialEndsAndWalletIsDeletedEvenWithBalance() {
        Instant now = Instant.now();
        User u = newUser("q3trial");
        insertSub(u.getId(), "PRO", "TRIAL", now.minus(8, ChronoUnit.DAYS), now.minus(1, ChronoUnit.DAYS));
        insertWallet(u.getId(), 50_000L, now);

        quotaService.reconcileForUser(u.getId(), now);

        assertThat(statusOf(u.getId(), "PRO")).isEqualTo("ENDED");
        assertThat(walletRows(u.getId()))
                .as("token trial là quà dùng thử, không mang sang ngày 8")
                .isZero();
        assertThat(statusOf(u.getId(), "DEFAULT")).isEqualTo("ACTIVE");
    }

    @Test
    @DisplayName("Q3 đối chứng: gói TRẢ PHÍ hết hạn còn ví → GIỮ ACTIVE để tiêu nốt (grace-drain)")
    void expiredPaidKeepsGraceDrain() {
        Instant now = Instant.now();
        User u = newUser("q3paid");
        insertSub(u.getId(), "PRO", "IAP", now.minus(40, ChronoUnit.DAYS), now.minus(1, ChronoUnit.DAYS));
        insertWallet(u.getId(), 50_000L, now);

        quotaService.reconcileForUser(u.getId(), now);

        assertThat(statusOf(u.getId(), "PRO"))
                .as("người đã trả tiền được tiêu nốt token họ đã mua")
                .isEqualTo("ACTIVE");
        assertThat(walletRows(u.getId())).isEqualTo(1);
    }

    @Test
    @DisplayName("Q3: trial hết hạn mà ví đã cạn → cũng ENDED (không phụ thuộc số dư)")
    void expiredTrialWithEmptyWalletAlsoEnds() {
        Instant now = Instant.now();
        User u = newUser("q3trialempty");
        insertSub(u.getId(), "PRO", "TRIAL", now.minus(8, ChronoUnit.DAYS), now.minus(1, ChronoUnit.DAYS));
        insertWallet(u.getId(), 0L, now);

        quotaService.reconcileForUser(u.getId(), now);

        assertThat(statusOf(u.getId(), "PRO")).isEqualTo("ENDED");
        assertThat(walletRows(u.getId())).isZero();
    }

    // ─── Cờ isTrial trên response quyền lợi ────────────────────────────────────

    @Test
    @DisplayName("resolvePlanBadge: trial bật cờ isTrial + trialEndsAt; gói trả phí thì không")
    void planBadgeExposesTrialFlag() {
        Instant now = Instant.now();
        User trial = newUser("badgetrial");
        insertSub(trial.getId(), "PRO", "TRIAL", now.minus(1, ChronoUnit.DAYS), now.plus(6, ChronoUnit.DAYS));

        PlanBadge trialBadge = quotaService.resolvePlanBadge(trial.getId(), now);
        assertThat(trialBadge.isTrial()).isTrue();
        assertThat(trialBadge.trialEndsAt()).isNotNull();

        User paid = newUser("badgepaid");
        insertSub(paid.getId(), "PRO", "IAP", now.minus(1, ChronoUnit.DAYS), now.plus(29, ChronoUnit.DAYS));

        PlanBadge paidBadge = quotaService.resolvePlanBadge(paid.getId(), now);
        // Suy ra trial từ tier là sai: người đã trả tiền cũng PRO, và họ KHÔNG được ẩn paywall.
        assertThat(paidBadge.isTrial()).isFalse();
        assertThat(paidBadge.trialEndsAt()).isNull();
    }
}
