package com.deutschflow.admin.service;

import com.deutschflow.admin.dto.AdminRevenueAnalyticsResponse;
import com.deutschflow.payment.repository.PaymentTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminAnalyticsService {

    private final PaymentTransactionRepository paymentRepo;

    public AdminRevenueAnalyticsResponse getRevenueAnalytics(int page, int size) {
        // 1. Get Monthly Aggregated Data
        List<PaymentTransactionRepository.MonthlyRevenueProjection> monthlyData = paymentRepo.getMonthlyRevenue();
        
        long totalGross = 0;
        long totalNet = 0;

        List<AdminRevenueAnalyticsResponse.RevenueChartRow> chartData = monthlyData.stream().map(row -> {
            long gross = row.getGrossVnd() != null ? row.getGrossVnd() : 0;
            long subscribers = row.getSubscribers() != null ? row.getSubscribers() : 0;
            
            // Assuming 15% store fee and fixed 5M API cost per month for realistic reporting
            long storeFee = (long) (gross * 0.15);
            long apiCost = 5350000; 
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
}
