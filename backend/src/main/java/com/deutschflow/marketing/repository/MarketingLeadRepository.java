package com.deutschflow.marketing.repository;

import com.deutschflow.marketing.entity.MarketingLead;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface MarketingLeadRepository extends JpaRepository<MarketingLead, Long> {

    /** Số lead tạo từ {@code since} đến nay — dùng cho global daily cap của free-grade. */
    long countByCreatedAtAfter(Instant since);

    /** Số lead từ một IP (đã hash) kể từ {@code since} — per-IP rate limit. */
    long countByIpHashAndCreatedAtAfter(String ipHash, Instant since);

    /** Lead mới nhất cho admin follow-up. */
    @Query("SELECT l FROM MarketingLead l ORDER BY l.createdAt DESC")
    List<MarketingLead> findRecent(Pageable pageable);

    /** Lead mới nhất kể từ {@code since} (admin follow-up có lọc thời gian). */
    @Query("SELECT l FROM MarketingLead l WHERE l.createdAt >= :since ORDER BY l.createdAt DESC")
    List<MarketingLead> findRecentSince(@Param("since") Instant since, Pageable pageable);
}
