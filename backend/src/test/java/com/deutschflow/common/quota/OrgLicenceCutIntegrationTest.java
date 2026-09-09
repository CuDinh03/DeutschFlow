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
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * MỐC CẮT của giấy phép trung tâm trên Postgres THẬT: quá 7 ngày ân hạn chỉ-đọc thì quyền lợi gói
 * ORG của học viên bị thu hồi; còn trong ân hạn thì KHÔNG đụng tới.
 *
 * <p>Đây là chỗ chứng minh {@code OrgLicenseState.Mode.CUT} không phải một mức enum chết: nó được
 * {@code SubscriptionReconcileJob} đọc và biến thành hành động thật trên {@code user_subscriptions}.
 *
 * <p>Gọi thẳng {@code cutLapsedOrganizations} chứ KHÔNG gọi {@code reconcileStaleSubscriptions}:
 * hàm kia mang {@code @SchedulerLock}, không lấy được khoá thì ShedLock bỏ qua trong im lặng và
 * test sẽ xanh mà chẳng chạy gì.
 */
@SpringBootTest
@DisplayName("Mốc CẮT giấy phép trung tâm (job đối soát)")
class OrgLicenceCutIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private SubscriptionReconcileJob job;

    private static final String EMAIL_PREFIX = "licence-cut-it-";
    private static final String SLUG_PREFIX = "licence-cut-it-";

    @AfterEach
    void tearDown() {
        String owned = "(SELECT id FROM users WHERE email LIKE '" + EMAIL_PREFIX + "%')";
        String orgs = "(SELECT id FROM organizations WHERE slug LIKE '" + SLUG_PREFIX + "%')";
        jdbcTemplate.update("DELETE FROM org_monthly_token_counters WHERE org_id IN " + orgs);
        jdbcTemplate.update("DELETE FROM user_subscriptions WHERE user_id IN " + owned);
        jdbcTemplate.update("DELETE FROM org_members WHERE user_id IN " + owned);
        jdbcTemplate.update("DELETE FROM users WHERE email LIKE '" + EMAIL_PREFIX + "%'");
        jdbcTemplate.update("DELETE FROM organizations WHERE slug LIKE '" + SLUG_PREFIX + "%'");
    }

    // ------------------------------------------------------------------ helpers

    private Long newUser(String tag) {
        return userRepository.save(User.builder()
                .email(EMAIL_PREFIX + tag + "-" + System.nanoTime() + "@test.com")
                .passwordHash("$2a$10$h").displayName("Cắt giấy phép IT")
                .role(User.Role.STUDENT).build()).getId();
    }

    private Long newOrg(String status, Instant validUntil, Instant suspendedAt) {
        Timestamp now = Timestamp.from(Instant.now());
        return jdbcTemplate.queryForObject("""
                INSERT INTO organizations
                    (name, slug, status, seat_limit, plan_code, monthly_token_pool, pool_unlimited,
                     valid_until, suspended_at, created_at, updated_at)
                VALUES (?, ?, ?, 0, 'PRO', 100000, false, ?, ?, ?, ?) RETURNING id
                """, Long.class, "Trung tâm cắt giấy phép", SLUG_PREFIX + System.nanoTime(), status,
                validUntil == null ? null : Timestamp.from(validUntil),
                suspendedAt == null ? null : Timestamp.from(suspendedAt), now, now);
    }

    /** Học viên ACTIVE của trung tâm, đang giữ một gói nguồn ORG còn hạn dài. */
    private Long studentWithOrgPlan(Long orgId, String tag) {
        Long userId = newUser(tag);
        jdbcTemplate.update("""
                INSERT INTO org_members (org_id, user_id, role, status, joined_at)
                VALUES (?, ?, 'STUDENT', 'ACTIVE', now())
                """, orgId, userId);
        Timestamp now = Timestamp.from(Instant.now());
        jdbcTemplate.update("""
                INSERT INTO user_subscriptions
                    (user_id, plan_code, status, starts_at, ends_at, source, created_at, updated_at)
                VALUES (?, 'PRO', 'ACTIVE', ?, ?, 'ORG', ?, ?)
                """, userId, now,
                Timestamp.from(Instant.now().plus(365, ChronoUnit.DAYS)), now, now);
        return userId;
    }

    private long activeOrgPlans(Long userId) {
        Long n = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM user_subscriptions
                WHERE user_id = ? AND source = 'ORG' AND status = 'ACTIVE'
                """, Long.class, userId);
        return n == null ? 0L : n;
    }

    private static Instant daysAgo(int days) {
        return Instant.now().minus(days, ChronoUnit.DAYS);
    }

    // ------------------------------------------------------------------ đình chỉ

    @Test
    @DisplayName("đình chỉ 3 ngày (còn ân hạn chỉ-đọc) → KHÔNG cắt quyền lợi học viên")
    void suspendedWithinGrace_keepsEntitlement() {
        Long orgId = newOrg("SUSPENDED", null, daysAgo(3));
        Long userId = studentWithOrgPlan(orgId, "suspended-grace");

        job.cutLapsedOrganizations(Instant.now());

        assertThat(activeOrgPlans(userId))
                .as("owner 09/09: đình chỉ cũng được 7 ngày ân hạn, không cắt phăng")
                .isEqualTo(1L);
    }

    @Test
    @DisplayName("đình chỉ 8 ngày (quá ân hạn) → CẮT quyền lợi ORG")
    void suspendedPastGrace_cutsEntitlement() {
        Long orgId = newOrg("SUSPENDED", null, daysAgo(8));
        Long userId = studentWithOrgPlan(orgId, "suspended-cut");

        job.cutLapsedOrganizations(Instant.now());

        assertThat(activeOrgPlans(userId)).isZero();
    }

    @Test
    @DisplayName("đình chỉ mà mốc neo NULL → CẮT ngay, không để fail-open vô thời hạn")
    void suspendedWithoutAnchor_cutsEntitlement() {
        Long orgId = newOrg("SUSPENDED", null, null);
        Long userId = studentWithOrgPlan(orgId, "suspended-no-anchor");

        job.cutLapsedOrganizations(Instant.now());

        assertThat(activeOrgPlans(userId)).isZero();
    }

    // ------------------------------------------------------------------ hết hạn

    @Test
    @DisplayName("hết hạn 3 ngày (còn ân hạn chỉ-đọc) → chưa tới mốc cắt")
    void expiredWithinGrace_keepsEntitlement() {
        Long orgId = newOrg("ACTIVE", daysAgo(3), null);
        Long userId = studentWithOrgPlan(orgId, "expired-grace");

        job.cutLapsedOrganizations(Instant.now());

        assertThat(activeOrgPlans(userId)).isEqualTo(1L);
    }

    @Test
    @DisplayName("hết hạn 8 ngày (quá ân hạn) → CẮT quyền lợi ORG")
    void expiredPastGrace_cutsEntitlement() {
        Long orgId = newOrg("ACTIVE", daysAgo(8), null);
        Long userId = studentWithOrgPlan(orgId, "expired-cut");

        job.cutLapsedOrganizations(Instant.now());

        assertThat(activeOrgPlans(userId)).isZero();
    }

    // ------------------------------------------------------------------ không đụng nhầm

    @Test
    @DisplayName("trung tâm còn hiệu lực → vòng quét không đụng một dòng nào")
    void healthyOrg_untouched() {
        Long orgId = newOrg("ACTIVE", Instant.now().plus(30, ChronoUnit.DAYS), null);
        Long userId = studentWithOrgPlan(orgId, "healthy");

        job.cutLapsedOrganizations(Instant.now());

        assertThat(activeOrgPlans(userId)).isEqualTo(1L);
    }

    @Test
    @DisplayName("giấy phép VÔ THỜI HẠN (validUntil null, ACTIVE) → không bao giờ bị cắt")
    void perpetualLicence_untouched() {
        Long orgId = newOrg("ACTIVE", null, null);
        Long userId = studentWithOrgPlan(orgId, "perpetual");

        job.cutLapsedOrganizations(Instant.now());

        assertThat(activeOrgPlans(userId)).isEqualTo(1L);
    }
}
