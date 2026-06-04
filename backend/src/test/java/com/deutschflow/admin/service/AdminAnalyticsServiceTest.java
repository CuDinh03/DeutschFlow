package com.deutschflow.admin.service;

import com.deutschflow.admin.dto.AdminRevenueAnalyticsResponse;
import com.deutschflow.payment.repository.PaymentTransactionRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@DisplayName("AdminAnalyticsService — revenue aggregation")
@ExtendWith(MockitoExtension.class)
class AdminAnalyticsServiceTest {

    @Mock PaymentTransactionRepository paymentRepo;
    @InjectMocks AdminAnalyticsService service;

    @Test
    @DisplayName("all rows from getMonthlyRevenue() are summed — no silent provider exclusion by status")
    void getRevenueAnalytics_sumsAllReturnedRows() {
        when(paymentRepo.getMonthlyRevenue()).thenReturn(List.of(
                projection("2026-05", 3L, 18_000_000L),
                projection("2026-06", 2L, 14_000_000L)
        ));
        when(paymentRepo.getAdminTransactions(any())).thenReturn(Page.empty());

        AdminRevenueAnalyticsResponse resp = service.getRevenueAnalytics(0, 10);

        assertThat(resp.getTotals().getGrossVnd()).isEqualTo(32_000_000L);
        assertThat(resp.getChartData()).hasSize(2);
        assertThat(resp.getChartData().get(0).getPeriod()).isEqualTo("2026-05");
        assertThat(resp.getChartData().get(0).getGrossVnd()).isEqualTo(18_000_000L);
        assertThat(resp.getChartData().get(1).getGrossVnd()).isEqualTo(14_000_000L);
    }

    @Test
    @DisplayName("zero rows returns zero totals without errors")
    void getRevenueAnalytics_noRows_returnsZeroTotals() {
        when(paymentRepo.getMonthlyRevenue()).thenReturn(List.of());
        when(paymentRepo.getAdminTransactions(any())).thenReturn(Page.empty());

        AdminRevenueAnalyticsResponse resp = service.getRevenueAnalytics(0, 10);

        assertThat(resp.getTotals().getGrossVnd()).isZero();
        assertThat(resp.getChartData()).isEmpty();
    }

    private PaymentTransactionRepository.MonthlyRevenueProjection projection(String period, long subs, long gross) {
        return new PaymentTransactionRepository.MonthlyRevenueProjection() {
            public String getPeriod() { return period; }
            public Long getSubscribers() { return subs; }
            public Long getGrossVnd() { return gross; }
        };
    }
}
