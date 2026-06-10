package com.deutschflow.admin.service;

import com.deutschflow.admin.dto.AdminRevenueAnalyticsResponse;
import com.deutschflow.common.quota.AiCostEstimator;
import com.deutschflow.payment.repository.PaymentTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminAnalyticsService {

    /** App-store cut applied to gross revenue for net/margin reporting. */
    private static final double STORE_FEE_RATE = 0.15;

    private final PaymentTransactionRepository paymentRepo;
    private final JdbcTemplate jdbcTemplate;
    private final AiCostEstimator aiCostEstimator;

    public AdminRevenueAnalyticsResponse getRevenueAnalytics(int page, int size) {
        // 1. Get Monthly Aggregated Data
        List<PaymentTransactionRepository.MonthlyRevenueProjection> monthlyData = paymentRepo.getMonthlyRevenue();

        // Real AI COGS per month, derived from the token ledger (keyed "YYYY-MM" in VN time
        // to match the revenue period grouping). Replaces the former hardcoded 5.35M VND.
        Map<String, Long> apiCostByMonth = aiCostVndByMonth();

        long totalGross = 0;
        long totalNet = 0;

        List<AdminRevenueAnalyticsResponse.RevenueChartRow> chartData = monthlyData.stream().map(row -> {
            long gross = row.getGrossVnd() != null ? row.getGrossVnd() : 0;
            long subscribers = row.getSubscribers() != null ? row.getSubscribers() : 0;

            long storeFee = (long) (gross * STORE_FEE_RATE);
            long apiCost = apiCostByMonth.getOrDefault(row.getPeriod(), 0L);
            long net = gross - storeFee - apiCost;

            double margin = gross > 0 ? ((double) net / gross) * 100 : 0.0;

            return AdminRevenueAnalyticsResponse.RevenueChartRow.builder()
                    .period(row.getPeriod())
                    .subscribers(subscribers)
                    .grossVnd(gross)
                    .netVnd(net)
                    .storeFeeVnd(storeFee)
                    .apiCostVnd(apiCost)
                    .marginPct(Math.round(margin * 10.0) / 10.0)
                    .build();
        }).collect(Collectors.toList());

        for (AdminRevenueAnalyticsResponse.RevenueChartRow row : chartData) {
            totalGross += row.getGrossVnd();
            totalNet += row.getNetVnd();
        }

        double totalMargin = totalGross > 0 ? ((double) totalNet / totalGross) * 100 : 0.0;
        AdminRevenueAnalyticsResponse.OverviewTotals totals = AdminRevenueAnalyticsResponse.OverviewTotals.builder()
                .grossVnd(totalGross)
                .netVnd(totalNet)
                .marginPct(Math.round(totalMargin * 10.0) / 10.0)
                .build();

        // 2. Get Paginated Transactions
        Pageable pageable = PageRequest.of(page, size);
        Page<PaymentTransactionRepository.PaymentTransactionDtoProjection> pageResult = paymentRepo.getAdminTransactions(pageable);

        List<AdminRevenueAnalyticsResponse.TransactionDto> transactions = pageResult.getContent().stream().map(t ->
                AdminRevenueAnalyticsResponse.TransactionDto.builder()
                        .id(t.getId())
                        .email(t.getEmail())
                        .planCode(t.getPlanCode())
                        .amount(t.getAmount())
                        .status(t.getStatus())
                        .providerTransactionId(t.getProviderTransactionId())
                        .createdAt(t.getCreatedAt())
                        .build()
        ).collect(Collectors.toList());

        AdminRevenueAnalyticsResponse.TransactionPage transactionPage = AdminRevenueAnalyticsResponse.TransactionPage.builder()
                .content(transactions)
                .totalPages(pageResult.getTotalPages())
                .totalElements(pageResult.getTotalElements())
                .build();

        return AdminRevenueAnalyticsResponse.builder()
                .totals(totals)
                .chartData(chartData)
                .transactions(transactionPage)
                .build();
    }

    /**
     * Real AI token cost per calendar month (VN time), keyed "YYYY-MM" to align with the
     * revenue period grouping. Priced via {@link AiCostEstimator} split input/output rates.
     * Months with no ledger rows are simply absent (caller defaults them to 0).
     */
    private Map<String, Long> aiCostVndByMonth() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT
                    TO_CHAR(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM') AS period,
                    COALESCE(model, 'unknown')                                     AS model,
                    SUM(prompt_tokens)::bigint                                      AS prompt_tokens,
                    SUM(completion_tokens)::bigint                                  AS completion_tokens
                FROM ai_token_usage_events
                GROUP BY 1, 2
                """);

        Map<String, Double> usdByMonth = new HashMap<>();
        for (Map<String, Object> row : rows) {
            String period = String.valueOf(row.get("period"));
            String model = String.valueOf(row.get("model"));
            long prompt = toLong(row.get("prompt_tokens"));
            long completion = toLong(row.get("completion_tokens"));
            usdByMonth.merge(period, aiCostEstimator.costUsd(model, prompt, completion), Double::sum);
        }

        Map<String, Long> vndByMonth = new HashMap<>(usdByMonth.size());
        usdByMonth.forEach((period, usd) -> vndByMonth.put(period, aiCostEstimator.toVnd(usd)));
        return vndByMonth;
    }

    private static long toLong(Object value) {
        return value instanceof Number n ? n.longValue() : 0L;
    }
}
