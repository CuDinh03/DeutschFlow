package com.deutschflow.moderation.repository;

import com.deutschflow.moderation.entity.ContentReport;
import com.deutschflow.moderation.entity.ContentReport.Context;
import com.deutschflow.moderation.entity.ContentReport.Status;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ContentReportRepository extends JpaRepository<ContentReport, Long> {

    List<ContentReport> findTop200ByOrderByCreatedAtDesc();

    List<ContentReport> findTop200ByStatusOrderByCreatedAtDesc(Status status);

    // ── Khử trùng (B2, 10/09/2026) ───────────────────────────────────────────
    // Khoá trùng = (reporter, context, đối tượng) khi còn một báo cáo PENDING cùng khoá. Ba hàm thay
    // vì một @Query với tham số nullable: mỗi ngữ cảnh có đúng một cột đối tượng, và một câu JPQL
    // "OR theo context" sẽ khớp nhầm khi cột của ngữ cảnh khác tình cờ cùng giá trị.

    Optional<ContentReport> findFirstByReporterIdAndContextAndMessageIdAndStatusOrderByCreatedAtDesc(
            Long reporterId, Context context, Long messageId, Status status);

    Optional<ContentReport> findFirstByReporterIdAndContextAndClassMessageIdAndStatusOrderByCreatedAtDesc(
            Long reporterId, Context context, Long classMessageId, Status status);

    Optional<ContentReport> findFirstByReporterIdAndContextAndReportedUserIdAndStatusOrderByCreatedAtDesc(
            Long reporterId, Context context, Long reportedUserId, Status status);
}
