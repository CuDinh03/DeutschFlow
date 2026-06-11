package com.deutschflow.marketing.repository;

import com.deutschflow.marketing.entity.SharedGradeReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;

public interface SharedGradeReportRepository extends JpaRepository<SharedGradeReport, Long> {
    Optional<SharedGradeReport> findByShareToken(String shareToken);

    /** Số report tạo từ {@code since} — growth funnel. */
    long countByCreatedAtAfter(Instant since);

    /** Điểm trung bình các report (null nếu chưa có report nào). */
    @Query("SELECT AVG(r.score) FROM SharedGradeReport r")
    Double averageScore();
}
