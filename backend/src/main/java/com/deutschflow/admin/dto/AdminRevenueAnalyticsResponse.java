package com.deutschflow.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminRevenueAnalyticsResponse {
    private OverviewTotals totals;
    private List<RevenueChartRow> chartData;
    private TransactionPage transactions;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OverviewTotals {
        private Long grossVnd;
        private Long netVnd;
        private Double marginPct;
        /** 09/11/2026: tách nguồn — giao dịch cá nhân (B2C) và hoá đơn trung tâm đã thu (B2B). */
        private Long b2cGrossVnd;
        private Long b2bGrossVnd;
        private Long paymentFeeVnd;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RevenueChartRow {
        private String period; // e.g., "2026-05"
        /** Số GIAO DỊCH B2C thành công trong kỳ (không phải số thuê bao — AC-ADMIN-13). */
        private Long subscribers;
        /** b2cGrossVnd + b2bGrossVnd. */
        private Long grossVnd;
        /** grossVnd − paymentFeeVnd − apiCostVnd. */
        private Long netVnd;
        /** Giữ tên cũ cho client cũ; từ 09/11/2026 bằng {@link #paymentFeeVnd} (phí theo nhà cung cấp). */
        private Long storeFeeVnd;
        private Long apiCostVnd;
        private Double marginPct;
        /** Giao dịch cá nhân SUCCESS trong kỳ (giờ VN), đã loại tài khoản demo. */
        private Long b2cGrossVnd;
        /** Hoá đơn trung tâm PAID, theo tháng {@code paid_at} (giờ VN), đã loại trung tâm demo. */
        private Long b2bGrossVnd;
        private Long b2bInvoices;
        /** Phí cổng thanh toán theo {@code payment_transactions.provider} (cấu hình app.payment.fee-rate.*). */
        private Long paymentFeeVnd;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TransactionPage {
        private List<TransactionDto> content;
        private int totalPages;
        private long totalElements;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TransactionDto {
        private Long id;
        private String email;
        private String planCode;
        private Long amount;
        private String status;
        private String providerTransactionId;
        private Instant createdAt;
    }
}
