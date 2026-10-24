package com.deutschflow.marketing.repository;

import com.deutschflow.marketing.entity.SchoolDemoRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface SchoolDemoRequestRepository extends JpaRepository<SchoolDemoRequest, Long> {

    /** Số yêu cầu toàn hệ thống kể từ {@code since} — trần chống spam. */
    long countByCreatedAtAfter(Instant since);

    /** Số yêu cầu từ một IP (đã hash) kể từ {@code since}. */
    long countByIpHashAndCreatedAtAfter(String ipHash, Instant since);

    /** Yêu cầu mới nhất kể từ {@code since} cho admin liên hệ lại. */
    @Query("SELECT r FROM SchoolDemoRequest r WHERE r.createdAt >= :since ORDER BY r.createdAt DESC")
    List<SchoolDemoRequest> findRecentSince(@Param("since") Instant since, Pageable pageable);
}
