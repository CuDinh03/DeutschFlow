package com.deutschflow.organization.service;

import com.deutschflow.organization.service.OrgQuotaService.OrgReservation;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * H-3 (audit B2B 07-04) — hợp đồng chống-TOCTOU của {@link OrgQuotaService#tryReserve}: hai request
 * ĐỒNG THỜI cùng xin suất sát trần pool thì đúng MỘT request được qua; counter không bao giờ vượt
 * pool. Đây chính là kịch bản mà check-then-act cũ ({@code wouldExceedOrgPool}) để lọt.
 *
 * <p>Chạy trên Postgres thật (Flyway đầy đủ) vì cái được test là tính atomic của conditional-upsert
 * — mock JDBC không chứng minh được gì. Tự skip khi không có Docker/EXTERNAL JDBC.
 *
 * <p>Phụ thuộc user seed {@code student@deutschflow.com} (V7/V8/V50). Nếu seed demo được dời sang
 * migration-local (việc còn nợ của P0-15), test tự skip qua {@code assumeTrue} thay vì fail.
 */
@SpringBootTest
class OrgPoolReserveConcurrencyIT extends AbstractPostgresIntegrationTest {

    private static final long POOL = 1_000L;

    @Autowired
    private OrgQuotaService orgQuotaService;

    @Autowired
    private JdbcTemplate jdbc;

    private Long orgId;
    private Long userId;

    @BeforeEach
    void seedOrgWithMeteredPool() {
        userId = jdbc.query("SELECT id FROM users WHERE email = 'student@deutschflow.com'",
                rs -> rs.next() ? rs.getLong(1) : null);
        Assumptions.assumeTrue(userId != null,
                "Seed user student@deutschflow.com không có trong DB test — bỏ qua (seed đã dời?)");

        orgId = jdbc.queryForObject("""
                        INSERT INTO organizations (name, slug, monthly_token_pool, pool_unlimited)
                        VALUES ('IT Reserve Org', 'it-reserve-' || substr(md5(random()::text), 1, 10), ?, false)
                        RETURNING id
                        """,
                Long.class, POOL);
        // Một user chỉ thuộc 1 org (LIMIT 1 ở resolve) — dọn membership cũ để test tất định.
        jdbc.update("DELETE FROM org_members WHERE user_id = ?", userId);
        jdbc.update("INSERT INTO org_members (org_id, user_id, role, status) VALUES (?, ?, 'STUDENT', 'ACTIVE')",
                orgId, userId);
        jdbc.update("DELETE FROM org_monthly_token_counters WHERE org_id = ?", orgId);
    }

    @AfterEach
    void cleanup() {
        if (orgId != null) {
            jdbc.update("DELETE FROM org_monthly_token_counters WHERE org_id = ?", orgId);
            jdbc.update("DELETE FROM org_members WHERE org_id = ?", orgId);
            jdbc.update("DELETE FROM organizations WHERE id = ?", orgId);
        }
    }

    private long counterNow() {
        Long v = jdbc.query(
                "SELECT tokens_used FROM org_monthly_token_counters WHERE org_id = ?",
                rs -> rs.next() ? rs.getLong(1) : null, orgId);
        return v != null ? v : 0L;
    }

    @Test
    @DisplayName("2 thread cùng xin 600/1000 đồng thời → đúng 1 pass, counter không vượt pool")
    void concurrentReserve_onlyOneWins() throws Exception {
        CyclicBarrier barrier = new CyclicBarrier(2);
        Callable<Boolean> attempt = () -> {
            barrier.await();
            return orgQuotaService.tryReserve(userId, 600L).isPresent();
        };
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Future<Boolean>> results = pool.invokeAll(List.of(attempt, attempt));
            long wins = results.stream().filter(f -> {
                try {
                    return f.get();
                } catch (Exception e) {
                    throw new AssertionError(e);
                }
            }).count();

            assertThat(wins).as("đúng một request được giữ chỗ").isEqualTo(1L);
            assertThat(counterNow()).isEqualTo(600L);
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    @DisplayName("reserve rồi refund trả counter về nguyên trạng")
    void reserveThenRefund_restoresCounter() {
        Optional<OrgReservation> r = orgQuotaService.tryReserve(userId, 600L);
        assertThat(r).isPresent();
        assertThat(counterNow()).isEqualTo(600L);

        orgQuotaService.refund(r.get());
        assertThat(counterNow()).isZero();
    }

    @Test
    @DisplayName("lấp pool tuần tự: 600 pass → 600 fail (vượt) → 400 pass (chạm trần đúng)")
    void sequentialFill_respectsCeiling() {
        assertThat(orgQuotaService.tryReserve(userId, 600L)).isPresent();
        assertThat(orgQuotaService.tryReserve(userId, 600L)).isEmpty();
        assertThat(orgQuotaService.tryReserve(userId, 400L)).isPresent();
        assertThat(counterNow()).isEqualTo(POOL);
        assertThat(orgQuotaService.tryReserve(userId, 1L)).isEmpty();
    }

    @Test
    @DisplayName("est lớn hơn cả pool bị chặn ngay, không tạo row counter")
    void estimateLargerThanPool_blockedWithoutTouchingCounter() {
        assertThat(orgQuotaService.tryReserve(userId, POOL + 500L)).isEmpty();
        assertThat(counterNow()).isZero();
    }
}
