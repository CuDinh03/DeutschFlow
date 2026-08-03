package com.deutschflow.common.quota;

import com.deutschflow.organization.service.OrgQuotaService;
import com.deutschflow.speaking.exception.AiErrorCode;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 2 kênh token (đã quyết 26/07) — hợp đồng end-to-end trên Postgres thật:
 * <ul>
 *   <li><b>Kênh 1 (STUDENT org + B2C)</b>: chỉ ví cá nhân. HV/PRO không còn chết vì pool org
 *       chưa cấu hình (P0-01 — ca {@code qa.hv08}); usage HV không đổ vào counter pool.</li>
 *   <li><b>Kênh 2 (staff org)</b>: chỉ pool trung tâm. GV ví-0đ vẫn chạy nếu pool còn (Q1);
 *       usage staff không trừ ví cá nhân; pool chặn thì mã lỗi tách "đã cạn"/"chưa cấu hình".</li>
 * </ul>
 * Không outer {@code @Transactional} ({@code assertAllowed}/{@code tryReserve} dùng REQUIRES_NEW);
 * dọn dữ liệu tường minh theo prefix email.
 */
@SpringBootTest
class TwoChannelTokenPoolIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String EMAIL_PREFIX = "twoch-it-";

    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private QuotaService quotaService;
    @Autowired private OrgQuotaService orgQuotaService;
    @Autowired private AiUsageLedgerService aiUsageLedgerService;

    @AfterEach
    void cleanup() {
        // Suất giữ chỗ do assertAllowed đặt vào ThreadLocal của thread test — không có filter dọn.
        OrgReservationHolder.take();
        jdbc.update("DELETE FROM org_monthly_token_counters WHERE org_id IN (SELECT id FROM organizations WHERE slug LIKE 'twoch-it-%')");
        jdbc.update("DELETE FROM org_members WHERE user_id IN (SELECT id FROM users WHERE email LIKE ?)", EMAIL_PREFIX + "%");
        // Events mang FK org_id → phải xoá TRƯỚC organizations.
        jdbc.update("DELETE FROM ai_token_usage_events WHERE user_id IN (SELECT id FROM users WHERE email LIKE ?)", EMAIL_PREFIX + "%");
        jdbc.update("DELETE FROM organizations WHERE slug LIKE 'twoch-it-%'");
        jdbc.update("DELETE FROM user_ai_token_wallets WHERE user_id IN (SELECT id FROM users WHERE email LIKE ?)", EMAIL_PREFIX + "%");
        jdbc.update("DELETE FROM user_subscriptions WHERE user_id IN (SELECT id FROM users WHERE email LIKE ?)", EMAIL_PREFIX + "%");
        jdbc.update("DELETE FROM users WHERE email LIKE ?", EMAIL_PREFIX + "%");
    }

    // ── Kênh 2: staff ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("Q1: GV ví-0đ (không subscription) vẫn qua gate khi pool trung tâm còn chỗ")
    void staff_zeroWallet_passesWhenPoolHasRoom() {
        long orgId = newOrg(10_000L, false);
        long uid = newUser("staff-pass", User.Role.TEACHER);
        addMember(orgId, uid, "TEACHER");

        QuotaSnapshot snap = quotaService.assertAllowed(uid, Instant.now(), 500L);

        assertThat(snap).isNotNull();
        assertThat(counter(orgId)).as("suất giữ chỗ H-3 đã cộng trước est").isEqualTo(500L);
    }

    @Test
    @DisplayName("Staff + org chưa cấu hình pool → 429 ORG_BUDGET_NOT_CONFIGURED (không phải QUOTA_EXCEEDED)")
    void staff_unconfiguredPool_throwsNotConfigured() {
        long orgId = newOrg(0L, false);
        long uid = newUser("staff-nocfg", User.Role.TEACHER);
        addMember(orgId, uid, "TEACHER");

        assertThatThrownBy(() -> quotaService.assertAllowed(uid, Instant.now(), 500L))
                .isInstanceOfSatisfying(QuotaExceededException.class, ex -> {
                    assertThat(ex.getCode()).isEqualTo(AiErrorCode.ORG_BUDGET_NOT_CONFIGURED);
                    assertThat(ex.getMessage()).contains("chưa được cấp");
                });
    }

    @Test
    @DisplayName("Staff + pool đã cạn → 429 ORG_BUDGET_EXHAUSTED")
    void staff_exhaustedPool_throwsExhausted() {
        long orgId = newOrg(1_000L, false);
        long uid = newUser("staff-empty", User.Role.TEACHER);
        addMember(orgId, uid, "TEACHER");
        jdbc.update("""
                        INSERT INTO org_monthly_token_counters (org_id, month_start, tokens_used)
                        VALUES (?, date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 1000)
                        """, orgId);

        assertThatThrownBy(() -> quotaService.assertAllowed(uid, Instant.now(), 500L))
                .isInstanceOfSatisfying(QuotaExceededException.class, ex -> {
                    assertThat(ex.getCode()).isEqualTo(AiErrorCode.ORG_BUDGET_EXHAUSTED);
                    assertThat(ex.getMessage()).contains("đã hết");
                });
    }

    @Test
    @DisplayName("Q1 charge: usage staff cộng pool trung tâm, ví cá nhân + gói PRO còn NGUYÊN (không downgrade oan)")
    void staff_usage_chargesPoolNotWallet() {
        long orgId = newOrg(10_000L, false);
        long uid = newUser("staff-charge", User.Role.TEACHER);
        addMember(orgId, uid, "TEACHER");
        insertSubscription(uid, "PRO", Instant.now().minusSeconds(600), null);
        insertWalletAccruedToday(uid, 50L); // ví gần cạn — trước đây debit 500 sẽ downgrade oan

        aiUsageLedgerService.record(uid, "GROQ", "m", 0, 500, 500, "TEACHER_AI_GRADING", null, null);

        assertThat(counter(orgId)).isEqualTo(500L);
        assertThat(walletBalance(uid)).as("Q1: ví staff không bị trừ ngầm").isEqualTo(50L);
        assertThat(activeCount(uid, "PRO")).as("không downgradePaidPlansToDefault oan").isEqualTo(1);
        assertThat(eventOrgId(uid)).as("sổ cái event vẫn quy org để báo cáo COGS").isEqualTo(orgId);
    }

    // ── Kênh 1: học viên org ─────────────────────────────────────────────────

    @Test
    @DisplayName("P0-01: HV/PRO qua gate dù org CHƯA cấu hình pool (ca qa.hv08)")
    void orgStudent_proWallet_passesDespiteUnconfiguredPool() {
        long orgId = newOrg(0L, false); // đúng trạng thái org 7 hôm 26/07
        long uid = newUser("hv-pro", User.Role.STUDENT);
        addMember(orgId, uid, "STUDENT");
        insertSubscription(uid, "PRO", Instant.now().minusSeconds(600), null);
        insertWalletAccruedToday(uid, 400_000L);

        QuotaSnapshot snap = quotaService.assertAllowed(uid, Instant.now(), 500L);

        assertThat(snap.remainingSpendable()).isEqualTo(400_000L);
        assertThat(counter(orgId)).as("HV không giữ chỗ pool").isZero();
    }

    @Test
    @DisplayName("HV ví cạn bị chặn QUOTA_EXCEEDED dù pool org unlimited — pool không cứu kênh ví")
    void orgStudent_emptyWallet_blockedEvenWithUnlimitedPool() {
        long orgId = newOrg(0L, true);
        long uid = newUser("hv-empty", User.Role.STUDENT);
        addMember(orgId, uid, "STUDENT");
        // Không subscription → DEFAULT, remainingSpendable = 0

        assertThatThrownBy(() -> quotaService.assertAllowed(uid, Instant.now(), 500L))
                .isInstanceOfSatisfying(QuotaExceededException.class,
                        ex -> assertThat(ex.getCode()).isEqualTo(AiErrorCode.QUOTA_EXCEEDED));
    }

    @Test
    @DisplayName("Charge HV: trừ ví cá nhân, counter pool trung tâm KHÔNG nhúc nhích (tiền HV hết đổ vào pool GV)")
    void orgStudent_usage_debitsWalletNotPool() {
        long orgId = newOrg(10_000L, false);
        long uid = newUser("hv-charge", User.Role.STUDENT);
        addMember(orgId, uid, "STUDENT");
        insertSubscription(uid, "PRO", Instant.now().minusSeconds(600), null);
        insertWalletAccruedToday(uid, 400_000L);

        aiUsageLedgerService.record(uid, "GROQ", "m", 0, 500, 500, "SPEAKING_CHAT", null, null);

        assertThat(counter(orgId)).as("usage HV không đụng counter pool").isZero();
        assertThat(walletBalance(uid)).isEqualTo(400_000L - 500L);
        assertThat(eventOrgId(uid)).as("sổ cái event vẫn quy org (COGS per-org không đổi)").isEqualTo(orgId);
    }

    @Test
    @DisplayName("tryReserve cho HV org trả NONE — không tạo row counter, không chặn")
    void tryReserve_student_returnsNone() {
        long orgId = newOrg(1_000L, false);
        long uid = newUser("hv-reserve", User.Role.STUDENT);
        addMember(orgId, uid, "STUDENT");

        var reservation = orgQuotaService.tryReserve(uid, 600L);

        assertThat(reservation).isPresent();
        assertThat(reservation.get().metered()).isFalse();
        assertThat(counter(orgId)).isZero();
    }

    // ── Multi-org: ưu tiên membership staff ──────────────────────────────────

    @Test
    @DisplayName("User vừa STUDENT org A vừa TEACHER org B → resolve ưu tiên membership staff (kênh trung tâm)")
    void multiOrg_staffMembershipWins() {
        long orgA = newOrg(0L, false);
        long orgB = newOrg(5_000L, false);
        long uid = newUser("multi", User.Role.TEACHER);
        addMember(orgA, uid, "STUDENT");
        addMember(orgB, uid, "TEACHER");

        var membership = orgQuotaService.resolveActiveMembership(uid);

        assertThat(membership).isNotNull();
        assertThat(membership.staff()).isTrue();
        assertThat(membership.orgId()).isEqualTo(orgB);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private long newOrg(long pool, boolean unlimited) {
        return jdbc.queryForObject("""
                        INSERT INTO organizations (name, slug, monthly_token_pool, pool_unlimited)
                        VALUES ('TwoCh IT Org', 'twoch-it-' || substr(md5(random()::text), 1, 10), ?, ?)
                        RETURNING id
                        """,
                Long.class, pool, unlimited);
    }

    private long newUser(String tag, User.Role role) {
        User u = userRepository.save(User.builder()
                .email(EMAIL_PREFIX + tag + "@test.com")
                .passwordHash("$2a$10$h")
                .displayName("TwoCh " + tag)
                .role(role)
                .build());
        userRepository.flush();
        return u.getId();
    }

    private void addMember(long orgId, long userId, String role) {
        jdbc.update("INSERT INTO org_members (org_id, user_id, role, status) VALUES (?, ?, ?, 'ACTIVE')",
                orgId, userId, role);
    }

    private void insertSubscription(long userId, String planCode, Instant startsAt, Instant endsAt) {
        jdbc.update("""
                        INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at)
                        VALUES (?, ?, 'ACTIVE', ?, ?)
                        """,
                userId, planCode, Timestamp.from(startsAt), endsAt == null ? null : Timestamp.from(endsAt));
    }

    /** Ví đã accrue tới hôm nay (giờ VN) — debit/gate không tự cộng thêm làm lệch expected. */
    private void insertWalletAccruedToday(long userId, long balance) {
        jdbc.update("""
                        INSERT INTO user_ai_token_wallets (user_id, balance, last_accrual_local_date)
                        VALUES (?, ?, ?)
                        """,
                userId, balance, Date.valueOf(QuotaVnCalendar.localDateOf(Instant.now())));
    }

    private long counter(long orgId) {
        Long v = jdbc.query(
                "SELECT tokens_used FROM org_monthly_token_counters WHERE org_id = ?",
                rs -> rs.next() ? rs.getLong(1) : null, orgId);
        return v != null ? v : 0L;
    }

    private long walletBalance(long userId) {
        Long v = jdbc.query("SELECT balance FROM user_ai_token_wallets WHERE user_id = ?",
                rs -> rs.next() ? rs.getLong(1) : null, userId);
        return v != null ? v : 0L;
    }

    private int activeCount(long userId, String planCode) {
        Integer v = jdbc.queryForObject("""
                        SELECT COUNT(*) FROM user_subscriptions
                        WHERE user_id = ? AND status = 'ACTIVE' AND plan_code = ?
                        """, Integer.class, userId, planCode);
        return v != null ? v : 0;
    }

    private Long eventOrgId(long userId) {
        return jdbc.query("SELECT org_id FROM ai_token_usage_events WHERE user_id = ? ORDER BY id DESC LIMIT 1",
                rs -> rs.next() ? rs.getLong(1) : null, userId);
    }
}
