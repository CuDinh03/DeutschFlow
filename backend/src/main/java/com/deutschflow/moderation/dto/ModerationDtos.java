package com.deutschflow.moderation.dto;

import com.deutschflow.moderation.entity.ContentReport;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;

/** DTOs for UGC safety (Apple Guideline 1.2): block + report. */
public final class ModerationDtos {

    /** POST /api/moderation/block — block a user. */
    public record BlockRequest(@NotNull Long userId) {}

    /** A user the caller has blocked (for the "Blocked users" management screen). */
    public record BlockedUserDto(Long userId, String displayName, Instant blockedAt) {}

    /**
     * POST /api/moderation/report — report a message or a user. Provide the target that matches
     * {@code context}: DIRECT_MESSAGE → {@code messageId}; CLASS_MESSAGE → {@code classMessageId}
     * (+ its {@code classId}); USER → {@code targetUserId}.
     */
    public record ReportRequest(
            @NotNull ContentReport.Context context,
            @NotNull ContentReport.Reason reason,
            Long targetUserId,
            Long messageId,
            Long classMessageId,
            Long classId,
            @Size(max = 1000) String details
    ) {}

    /**
     * POST /api/moderation/report — kết quả. {@code duplicate = true} khi người này đã có một báo cáo
     * PENDING cùng khoá (B2): {@code reportId} là id CŨ, không có dòng mới. Mobile chỉ đọc
     * {@code reportId} (mobile/lib/moderationApi.ts) nên trường thêm là tương thích.
     */
    public record ReportResponse(Long reportId, boolean duplicate) {}

    /**
     * Admin view of a report. {@code orgId} là ảnh chụp trung tâm của người bị tố cáo lúc ghi (V321);
     * {@code contentPurgedAt} khác null nghĩa là {@code details}/{@code snapshotBody} đã bị ẩn danh
     * hoặc dọn theo hạn lưu — màn admin nên hiện "nội dung đã dọn" thay vì ô trống.
     */
    public record ReportDto(
            Long id,
            Long reporterId,
            Long reportedUserId,
            String context,
            String reason,
            String details,
            String snapshotBody,
            String status,
            Instant createdAt,
            Instant resolvedAt,
            Long resolvedBy,
            Long orgId,
            Instant contentPurgedAt
    ) {
        public static ReportDto from(ContentReport r) {
            return new ReportDto(
                    r.getId(), r.getReporterId(), r.getReportedUserId(),
                    r.getContext().name(), r.getReason().name(), r.getDetails(),
                    r.getSnapshotBody(), r.getStatus().name(), r.getCreatedAt(),
                    r.getResolvedAt(), r.getResolvedBy(),
                    r.getOrgId(), r.getContentPurgedAt());
        }
    }

    private ModerationDtos() {}
}
