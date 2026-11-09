package com.deutschflow.admin.service;

import com.deutschflow.admin.dto.AdminRevenueAnalyticsResponse;
import com.deutschflow.common.quota.AiCostEstimator;
import com.deutschflow.payment.repository.PaymentTransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Cách tính doanh thu admin (đợt 1, 09/11/2026): B2C theo tháng × nhà cung cấp, phí theo nhà cung
 * cấp (Apple 15%, còn lại 0), cộng hoá đơn B2B PAID theo tháng thu, trừ chi phí AI. Kiểm bằng SQL
 * giả lập (phân luồng theo bảng được truy vấn); phần SQL thật kiểm ở
 * {@code AdminRevenueAnalyticsIntegrationTest} trên Postgres.
 */
@DisplayName("AdminAnalyticsService — revenue aggregation")
@ExtendWith(MockitoExtension.class)
class AdminAnalyticsServiceTest {

    @Mock PaymentTransactionRepository paymentRepo;
    @Mock JdbcTemplate jdbcTemplate;
    @Mock AiCostEstimator aiCostEstimator;
    @Mock DemoDataFilter demoDataFilter;

    private AdminAnalyticsService service;

    @BeforeEach
    void setUp() {
        service = new AdminAnalyticsService(paymentRepo, jdbcTemplate, aiCostEstimator, demoDataFilter,
                0.15, 0, 0, 0);
        lenient().when(demoDataFilter.whereExcludeDemo()).thenReturn("");
        lenient().when(demoDataFilter.andExcludeDemo()).thenReturn("");
        lenient().when(demoDataFilter.andExcludeDemoOrgs(anyString())).thenReturn("");
        lenient().when(paymentRepo.getAdminTransactions(any())).thenReturn(Page.empty());
    }

    private void stubSql(List<Map<String, Object>> b2c, List<Map<String, Object>> b2b) {
        when(jdbcTemplate.queryForList(anyString())).thenAnswer(inv -> {
            String sql = inv.getArgument(0);
            if (sql.contains("FROM payment_transactions")) return b2c;
            if (sql.contains("FROM org_invoices")) return b2b;
            return List.of(); // ai_token_usage_events: tháng không có chi phí AI
        });
    }

    @Test
    @DisplayName("cộng mọi dòng B2C + B2B theo kỳ; phí theo nhà cung cấp; kỳ chỉ có B2B vẫn xuất hiện")
    void sumsB2cAndB2b_withPerProviderFees() {
        stubSql(
                List.of(
                        Map.of("period", "2026-05", "provider", "APPLE", "tx", 2L, "gross", 10_000_000L),
                        Map.of("period", "2026-05", "provider", "MOMO", "tx", 1L, "gross", 8_000_000L),
                        Map.of("period", "2026-06", "provider", "STRIPE", "tx", 2L, "gross", 14_000_000L)),
                List.of(
                        Map.of("period", "2026-06", "invoices", 1L, "gross", 6_000_000L),
                        Map.of("period", "2026-07", "invoices", 2L, "gross", 4_000_000L)));

        AdminRevenueAnalyticsResponse resp = service.getRevenueAnalytics(0, 10);

        assertThat(resp.getChartData()).extracting(AdminRevenueAnalyticsResponse.RevenueChartRow::getPeriod)
                .containsExactly("2026-05", "2026-06", "2026-07");
        AdminRevenueAnalyticsResponse.RevenueChartRow may = resp.getChartData().get(0);
        assertThat(may.getGrossVnd()).isEqualTo(18_000_000L);
        assertThat(may.getPaymentFeeVnd()).isEqualTo(1_500_000L); // chỉ phần Apple
        assertThat(may.getNetVnd()).isEqualTo(16_500_000L);
        assertThat(may.getSubscribers()).isEqualTo(3L);

        AdminRevenueAnalyticsResponse.RevenueChartRow june = resp.getChartData().get(1);
        assertThat(june.getB2cGrossVnd()).isEqualTo(14_000_000L);
        assertThat(june.getB2bGrossVnd()).isEqualTo(6_000_000L);
        assertThat(june.getPaymentFeeVnd()).isZero();

        AdminRevenueAnalyticsResponse.RevenueChartRow july = resp.getChartData().get(2);
        assertThat(july.getB2cGrossVnd()).isZero();
        assertThat(july.getB2bInvoices()).isEqualTo(2L);

        assertThat(resp.getTotals().getGrossVnd()).isEqualTo(42_000_000L);
        assertThat(resp.getTotals().getB2bGrossVnd()).isEqualTo(10_000_000L);
        assertThat(resp.getTotals().getPaymentFeeVnd()).isEqualTo(1_500_000L);
    }

    @Test
    @DisplayName("zero rows returns zero totals without errors")
    void noRows_returnsZeroTotals() {
        stubSql(List.of(), List.of());

        AdminRevenueAnalyticsResponse resp = service.getRevenueAnalytics(0, 10);

        assertThat(resp.getTotals().getGrossVnd()).isZero();
        assertThat(resp.getChartData()).isEmpty();
    }

    @Test
    @DisplayName("tỉ lệ phí cấu hình sai (âm / >1) bị kẹp về 0..1")
    void feeRateIsClamped() {
        AdminAnalyticsService odd = new AdminAnalyticsService(paymentRepo, jdbcTemplate, aiCostEstimator,
                demoDataFilter, 1.5, -0.2, 0, 0);
        assertThat(odd.feeRate("APPLE")).isEqualTo(1.0);
        assertThat(odd.feeRate("STRIPE")).isZero();
    }
}
