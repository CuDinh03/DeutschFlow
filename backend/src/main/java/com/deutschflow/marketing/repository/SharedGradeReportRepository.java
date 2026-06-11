package com.deutschflow.marketing.repository;

import com.deutschflow.marketing.entity.SharedGradeReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SharedGradeReportRepository extends JpaRepository<SharedGradeReport, Long> {
    Optional<SharedGradeReport> findByShareToken(String shareToken);
}
