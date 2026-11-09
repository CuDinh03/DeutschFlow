package com.deutschflow.admin.service;

import com.deutschflow.admin.dto.AdminRevenueAnalyticsResponse;
import com.deutschflow.common.quota.AiCostEstimator;
import com.deutschflow.payment.repository.PaymentTransactionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * Doanh thu cho trang admin.
 *
 * <p>Đợt 1 tối ưu admin (09/11/2026, owner chốt) — cách tính mới:
 * <ul>
 *   <li><b>B2C</b>: {@code payment_transactions} SUCCESS theo tháng {@code created_at} (giờ VN), đã loại
 *       tài khoản demo.</li>
 *   <li><b>Phí thanh toán theo nhà cung cấp</b> ({@code provider}) từ cấu hình
 *       {@code app.payment.fee-rate.*}: Apple 15% (chương trình doanh nghiệp nhỏ), Stripe/MoMo/SePay
 *       mặc định 0% — trước đây trừ 15% cho MỌI giao dịch. Nhà cung cấp lạ → 0% (không đoán).</li>
 *   <li><b>B2B</b>: hoá đơn trung tâm {@code org_invoices} PAID theo tháng {@code paid_at} (V366, giờ
 *       VN), đã loại trung tâm demo — trước đây không được cộng.</li>
 *   <li>Chi phí AI theo tháng từ ledger như cũ (đã loại demo).</li>
 * </ul>
 * net = (B2C + B2B) − phí thanh toán − chi phí AI. Đây KHÔNG phải MRR (ADMIN-08).
 */
@Service
public class AdminAnalyticsService {

    private final PaymentTransactionRepository paymentRepo;
    private final JdbcTemplate jdbcTemplate;
    private final AiCostEstimator aiCostEstimator;
    private final DemoDataFilter demoDataFilter;
    private final Map<String, Double> feeRateByProvider;

    public AdminAnalyticsService(
            PaymentTransactionRepository paymentRepo,
            JdbcTemplate jdbcTemplate,
            AiCostEstimator aiCostEstimator,
            DemoDataFilter demoDataFilter,
            @Value("${app.payment.fee-rate.apple:0.15}") double appleFeeRate,
            @Value("${app.payment.fee-rate.stripe:0}") double stripeFeeRate,
            @Value("${app.payment.fee-rate.momo:0}") double momoFeeRate,
            @Value("${app.payment.fee-rate.sepay:0}") double sepayFeeRate) {
        this.paymentRepo = paymentRepo;
        this.jdbcTemplate = jdbcTemplate;
        this.aiCostEstimator = aiCostEstimator;
        this.demoDataFilter = demoDataFilter;
        this.feeRateByProvider = Map.of(
                "APPLE", clampRate(appleFeeRate),
                "STRIPE", clampRate(stripeFeeRate),
                "MOMO", clampRate(momoFeeRate),
                "SEPAY", clampRate(sepayFeeRate));
    }

    /** Tỉ lệ phí đang áp cho một nhà cung cấp (0 nếu không cấu hình). */
    public double feeRate(String provider) {
        if (provider == null) {
            return 0.0;
        }
        return feeRateByProvider.getOrDefault(provider.trim().toUpperCase(Locale.ROOT), 0.0);
    }

    public AdminRevenueAnalyticsResponse getRevenueAnalytics(int page, int size) {
        Map<String, Period> periods = new TreeMap<>();

        // 1a. B2C theo tháng × nhà cung cấp (loại demo).
        List<Map<String, Object>> b2cRows = jdbcTemplate.queryForList("""
                SELECT TO_CHAR(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM') AS period,
                       UPPER(COALESCE(provider, 'UNKNOWN')) AS provider,
                       COUNT(id) AS tx,
                       COALESCE(SUM(amount), 0) AS gross
                FROM payment_transactions
                WHERE status = 'SUCCESS'%s
                GROUP BY 1, 2
                """.formatted(demoDataFilter.andExcludeDemo()));
        for (Map<String, Object> r : b2cRows) {
            Period p = periods.computeIfAbsent(String.valueOf(r.get("period")), k -> new Period());
            long gross = toLong(r.get("gross"));
            p.b2cGross += gross;
            p.tx += toLong(r.get("tx"));
            p.fee += Math.round(gross * feeRate(String.valueOf(r.get("provider"))));
        }

        // 1b. B2B: hoá đơn trung tâm đã thu, theo tháng thu tiền (loại trung tâm demo).
        List<Map<String, Object>> b2bRows = jdbcTemplate.queryForList("""
                SELECT TO_CHAR(paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM') AS period,
                       COUNT(*) AS invoices,
                       COALESCE(SUM(amount_vnd), 0) AS gross
                FROM org_invoices
                WHERE status = 'PAID' AND paid_at IS NOT NULL%s
                GROUP BY 1
                """.formatted(demoDataFilter.andExcludeDemoOrgs("org_id")));
        for (Map<String, Object> r : b2bRows) {
            Period p = periods.computeIfAbsent(String.valueOf(r.get("period")), k -> new Period());
            p.b2bGross += toLong(r.get("gross"));
            p.b2bInvoices += toLong(r.get("invoices"));
        }

        // Real AI COGS per month, derived from the token ledger (keyed "YYYY-MM" in VN time
        // to match the revenue period grouping). Replaces the former hardcoded 5.35M VND.
        Map<String, Long> apiCostByMonth = aiCostVndByMonth();

        long totalGross = 0;
        long totalNet = 0;
        long totalB2c = 0;
        long totalB2b = 0;
        long totalFee = 0;
        List<AdminRevenueAnalyticsResponse.RevenueChartRow> chartData = new ArrayList<>();
        for (Map.Entry<String, Period> e : periods.entrySet()) {
            Period p = e.getValue();
            long gross = p.b2cGross + p.b2bGross;
            long apiCost = apiCostByMonth.getOrDefault(e.getKey(), 0L);
            long net = gross - p.fee - apiCost;
            double margin = gross > 0 ? ((double) net / gross) * 100 : 0.0;
            chartData.add(AdminRevenueAnalyticsResponse.RevenueChartRow.builder()
                    .period(e.getKey())
                    .subscribers(p.tx)
                    .grossVnd(gross)
                    .netVnd(net)
                    .storeFeeVnd(p.fee)
                    .paymentFeeVnd(p.fee)
                    .apiCostVnd(apiCost)
                    .marginPct(Math.round(margin * 10.0) / 10.0)
                    .b2cGrossVnd(p.b2cGross)
                    .b2bGrossVnd(p.b2bGross)
                    .b2bInvoices(p.b2bInvoices)
                    .build());
            totalGross += gross;
            totalNet += net;
            totalB2c += p.b2cGross;
            totalB2b += p.b2bGross;
            totalFee += p.fee;
        }

        double totalMargin = totalGross > 0 ? ((double) totalNet / totalGross) * 100 : 0.0;
        AdminRevenueAnalyticsResponse.OverviewTotals totals = AdminRevenueAnalyticsResponse.OverviewTotals.builder()
                .grossVnd(totalGross)
                .netVnd(totalNet)
                .marginPct(Math.round(totalMargin * 10.0) / 10.0)
                .b2cGrossVnd(totalB2c)
                .b2bGrossVnd(totalB2b)
                .paymentFeeVnd(totalFee)
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

    /** Cộng dồn một kỳ (tháng giờ VN). */
    private static final class Period {
        long b2cGross;
        long tx;
        long fee;
        long b2bGross;
        long b2bInvoices;
    }

    /**
     * Real AI token cost per calendar month (VN time), keyed "YYYY-MM" to align with the
     * revenue period grouping. Priced via {@link AiCostEstimator} split input/output rates.
     * Months with no ledger rows are simply absent (caller defaults them to 0).
     */
    private Map<String, Long> aiCostVndByMonth() {
        // Demo-org activity is excluded so it doesn't inflate the per-month AI COGS that drives
        // net/margin reporting (see DemoDataFilter). All-time query → WHERE-form of the clause.
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT
                    TO_CHAR(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM') AS period,
                    COALESCE(model, 'unknown')                                     AS model,
                    SUM(prompt_tokens)::bigint                                      AS prompt_tokens,
                    SUM(cached_prompt_tokens)::bigint                               AS cached_prompt_tokens,
                    SUM(completion_tokens)::bigint                                  AS completion_tokens
                FROM ai_token_usage_events
                %s
                GROUP BY 1, 2
                """.formatted(demoDataFilter.whereExcludeDemo()));

        Map<String, Double> usdByMonth = new HashMap<>();
        for (Map<String, Object> row : rows) {
            String period = String.valueOf(row.get("period"));
            String model = String.valueOf(row.get("model"));
            long prompt = toLong(row.get("prompt_tokens"));
            // Phần prompt được nhà cung cấp phục vụ từ cache — rẻ hơn input thường 2–10×
            // (V270). Hàng ledger cũ không có số này ⇒ 0 ⇒ định giá y như trước.
            long cachedPrompt = toLong(row.get("cached_prompt_tokens"));
            long completion = toLong(row.get("completion_tokens"));
            usdByMonth.merge(period, aiCostEstimator.costUsd(model, prompt, cachedPrompt, completion), Double::sum);
        }

        Map<String, Long> vndByMonth = new HashMap<>(usdByMonth.size());
        usdByMonth.forEach((period, usd) -> vndByMonth.put(period, aiCostEstimator.toVnd(usd)));
        return vndByMonth;
    }

    private static double clampRate(double rate) {
        if (Double.isNaN(rate) || rate < 0) {
            return 0.0;
        }
        return Math.min(rate, 1.0);
    }

    private static long toLong(Object value) {
        return value instanceof Number n ? n.longValue() : 0L;
    }
}
