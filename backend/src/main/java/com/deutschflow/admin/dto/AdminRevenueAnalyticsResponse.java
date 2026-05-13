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
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RevenueChartRow {
        private String period; // e.g., "2026-05"
        private Long subscribers;
        private Long grossVnd;
        private Long netVnd;
        private Long storeFeeVnd;
        private Long apiCostVnd;
        private Double marginPct;
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
