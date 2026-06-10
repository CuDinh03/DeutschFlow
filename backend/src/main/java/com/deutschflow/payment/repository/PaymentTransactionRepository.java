package com.deutschflow.payment.repository;

import com.deutschflow.payment.entity.PaymentTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {
    Optional<PaymentTransaction> findByOrderId(String orderId);

    Optional<PaymentTransaction> findByOrderIdAndUserId(String orderId, Long userId);

    /**
     * Atomically claim the PENDING→SUCCESS transition for a payment. Returns 1 for the single caller
     * that wins the transition, 0 if it was already SUCCESS (idempotent replay). Collapses the old
     * read-check-set into one statement so two concurrent webhook deliveries can't both activate (P0-2).
     */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE PaymentTransaction t SET t.status = 'SUCCESS', t.providerTransactionId = :providerTxId " +
           "WHERE t.orderId = :orderId AND t.status <> 'SUCCESS'")
    int markSuccessIfNotAlready(@Param("orderId") String orderId, @Param("providerTxId") String providerTxId);

    interface MonthlyRevenueProjection {
        String getPeriod(); // e.g. "2026-05"
        Long getSubscribers();
        Long getGrossVnd();
    }

    @Query(value = "SELECT TO_CHAR(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM') as period, " +
                   "COUNT(id) as subscribers, " +
                   "SUM(amount) as grossVnd " +
                   "FROM payment_transactions " +
                   "WHERE status = 'SUCCESS' " +
                   "GROUP BY TO_CHAR(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM') " +
                   "ORDER BY period ASC", nativeQuery = true)
    List<MonthlyRevenueProjection> getMonthlyRevenue();

    interface PaymentTransactionDtoProjection {
        Long getId();
        String getEmail();
        String getPlanCode();
        Long getAmount();
        String getStatus();
        String getProviderTransactionId();
        Instant getCreatedAt();
    }

    @Query(value = "SELECT p.id as id, u.email as email, p.plan_code as planCode, " +
                   "p.amount as amount, p.status as status, " +
                   "p.provider_transaction_id as providerTransactionId, p.created_at as createdAt " +
                   "FROM payment_transactions p " +
                   "JOIN users u ON p.user_id = u.id " +
                   "ORDER BY p.created_at DESC", 
           countQuery = "SELECT count(p.id) FROM payment_transactions p",
           nativeQuery = true)
    Page<PaymentTransactionDtoProjection> getAdminTransactions(Pageable pageable);
}
