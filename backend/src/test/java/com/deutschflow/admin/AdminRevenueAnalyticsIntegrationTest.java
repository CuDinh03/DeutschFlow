package com.deutschflow.admin;

import com.deutschflow.admin.dto.AdminRevenueAnalyticsResponse;
import com.deutschflow.admin.service.AdminAnalyticsService;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Doanh thu admin — cách tính mới (đợt 1, 09/11/2026, owner chốt) — AC-ADMIN-24.
 *
 * <p>Dựng cả cảnh trong MỘT tháng xa ({@code 2001-03}) để không lẫn với dữ liệu của lớp test khác
 * trong DB dùng chung, rồi đọc đúng dòng của tháng đó:
 * <ul>
 *   <li>B2C: APPLE 1.000.000 (phí 15%), MOMO 2.000.000 (phí 0%), MOMO 5.000.000 của tài khoản demo
 *       (bị loại), một giao dịch FAILED (bị loại).</li>
 *   <li>B2B: hoá đơn PAID 3.000.000 của trung tâm thật, PAID 9.000.000 của trung tâm demo (bị loại),
 *       SENT 4.000.000 (chưa thu, bị loại).</li>
 * </ul>
 * ⇒ gross 6.000.000 = B2C 3.000.000 + B2B 3.000.000; phí 150.000; net 5.850.000 (tháng này không
 * có chi phí AI); 2 giao dịch; 1 hoá đơn.
 */
@SpringBootTest
@DisplayName("Admin · doanh thu: phí theo nhà cung cấp, cộng B2B theo tháng thu, loại demo")
class AdminRevenueAnalyticsIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String PERIOD = "2001-03";

    @Autowired private AdminAnalyticsService analyticsService;
    @Autowired private UserRepository userRepository;
    @Autowired private OrganizationRepository organizationRepo;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("tháng 2001-03: gross 6.000.000, phí 150.000, net 5.850.000, đã loại demo và hoá đơn chưa thu")
    void revenueForIsolatedPeriod() {
        User real = account("rev-" + UUID.randomUUID() + "@test.local", null);
        Organization realOrg = org("rev-real");
        Organization demoOrg = org("rev-demo");
        User demo = account("rev-" + UUID.randomUUID() + "@deutschflow-demo.com", demoOrg.getId());

        tx(real, "APPLE", 1_000_000, "SUCCESS");
        tx(real, "MOMO", 2_000_000, "SUCCESS");
        tx(real, "MOMO", 700_000, "FAILED");
        tx(demo, "MOMO", 5_000_000, "SUCCESS");

        invoice(realOrg, 3_000_000, "PAID", "2001-03-15 10:00:00+07");
        invoice(demoOrg, 9_000_000, "PAID", "2001-03-16 10:00:00+07");
        invoice(realOrg, 4_000_000, "SENT", null);

        AdminRevenueAnalyticsResponse res = analyticsService.getRevenueAnalytics(0, 1);
        AdminRevenueAnalyticsResponse.RevenueChartRow row = res.getChartData().stream()
                .filter(r -> PERIOD.equals(r.getPeriod()))
                .findFirst().orElseThrow();

        assertThat(row.getB2cGrossVnd()).isEqualTo(3_000_000L);
        assertThat(row.getB2bGrossVnd()).isEqualTo(3_000_000L);
        assertThat(row.getGrossVnd()).isEqualTo(6_000_000L);
        assertThat(row.getPaymentFeeVnd()).isEqualTo(150_000L);
        assertThat(row.getStoreFeeVnd()).isEqualTo(150_000L);
        assertThat(row.getApiCostVnd()).isZero();
        assertThat(row.getNetVnd()).isEqualTo(5_850_000L);
        assertThat(row.getSubscribers()).isEqualTo(2L);
        assertThat(row.getB2bInvoices()).isEqualTo(1L);
    }

    @Test
    @DisplayName("tỉ lệ phí: Apple 15%, MoMo/Stripe/SePay 0%, nhà cung cấp lạ 0%")
    void feeRates() {
        assertThat(analyticsService.feeRate("APPLE")).isEqualTo(0.15);
        assertThat(analyticsService.feeRate("apple")).isEqualTo(0.15);
        assertThat(analyticsService.feeRate("MOMO")).isZero();
        assertThat(analyticsService.feeRate("STRIPE")).isZero();
        assertThat(analyticsService.feeRate("SEPAY")).isZero();
        assertThat(analyticsService.feeRate("VNPAY")).isZero();
        assertThat(analyticsService.feeRate(null)).isZero();
    }

    private User account(String email, Long orgId) {
        User u = User.builder().email(email).passwordHash("x").displayName("Rev").role(User.Role.STUDENT).build();
        u.setOrgId(orgId);
        return userRepository.save(u);
    }

    private Organization org(String prefix) {
        return organizationRepo.save(Organization.builder()
                .name("TT " + prefix).slug(prefix + "-" + UUID.randomUUID()).seatLimit(5).status("ACTIVE").build());
    }

    private void tx(User u, String provider, long amount, String status) {
        jdbcTemplate.update("""
                INSERT INTO payment_transactions (order_id, user_id, plan_code, amount, provider, status, created_at, updated_at)
                VALUES (?, ?, 'PRO', ?, ?, ?, TIMESTAMPTZ '2001-03-10 12:00:00+07', TIMESTAMPTZ '2001-03-10 12:00:00+07')
                """, "rev-" + UUID.randomUUID(), u.getId(), amount, provider, status);
    }

    private void invoice(Organization o, long amount, String status, String paidAt) {
        jdbcTemplate.update("""
                INSERT INTO org_invoices (org_id, seats, amount_vnd, status, paid_at)
                VALUES (?, 5, ?, ?, CAST(? AS timestamptz))
                """, o.getId(), amount, status, paidAt);
    }
}
