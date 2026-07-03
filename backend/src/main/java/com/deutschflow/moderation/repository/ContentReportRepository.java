package com.deutschflow.moderation.repository;

import com.deutschflow.moderation.entity.ContentReport;
import com.deutschflow.moderation.entity.ContentReport.Status;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ContentReportRepository extends JpaRepository<ContentReport, Long> {

    List<ContentReport> findTop200ByOrderByCreatedAtDesc();

    List<ContentReport> findTop200ByStatusOrderByCreatedAtDesc(Status status);
}
