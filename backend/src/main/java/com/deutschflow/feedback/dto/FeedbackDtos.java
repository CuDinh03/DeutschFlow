package com.deutschflow.feedback.dto;

import com.deutschflow.feedback.FeedbackEnums.Area;
import com.deutschflow.feedback.FeedbackEnums.Audience;
import com.deutschflow.feedback.FeedbackEnums.Source;
import com.deutschflow.feedback.FeedbackEnums.Status;
import com.deutschflow.feedback.FeedbackEnums.Type;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** DTO của góp ý. Không DTO nào của người gửi chứa ghi chú nội bộ (FBK-23) hay IP/User-Agent (NFR-04). */
public final class FeedbackDtos {

    private FeedbackDtos() {}

    // ── Người gửi ─────────────────────────────────────────────────────────

    /** Form của người đang đăng nhập: nhóm người gửi + các phần được chọn (FBK-04, FBK-13). */
    public record FormOptions(Audience audience, List<Area> areas) {}

    /**
     * Thông tin kỹ thuật do trình duyệt gửi (BR-04). Mọi trường là chữ ngắn đã được client tóm gọn;
     * server cắt độ dài và bỏ query của đường dẫn trang lần nữa.
     */
    public record TechInfo(
            @Size(max = 200) String page,
            @Size(max = 60) String browser,
            @Size(max = 60) String os,
            @Size(max = 20) String device,
            @Size(max = 60) String build,
            @Size(max = 10) String locale,
            @Size(max = 20) String screen) {}

    public record CreateFeedbackRequest(
            @NotNull Type type,
            @NotNull Area area,
            @Min(1) @Max(5) Integer satisfaction,
            @NotNull @Size(max = 4000) String content,
            boolean allowContact,
            @Valid TechInfo techInfo,
            @Size(max = 3) List<Long> attachmentIds,
            @Size(max = 64) String clientRequestId) {}

    public record AttachmentUploaded(Long id, int width, int height, int sizeBytes) {}

    public record ReplyDto(Long id, String body, Instant createdAt) {}

    public record MyFeedbackDto(
            Long id,
            Type type,
            Area area,
            Source source,
            Integer satisfaction,
            String title,
            String content,
            Status status,
            int attachmentCount,
            Instant createdAt,
            Instant statusChangedAt,
            List<ReplyDto> replies) {}

    // ── ADMIN ─────────────────────────────────────────────────────────────

    public record AdminListItem(
            Long id,
            Type type,
            Area area,
            Source source,
            Integer satisfaction,
            boolean lowScore,
            String title,
            String excerpt,
            Status status,
            String authorName,
            String authorRole,
            String authorLevel,
            int attachmentCount,
            int replyCount,
            Instant createdAt) {}

    public record AdminListPage(
            List<AdminListItem> items,
            long total,
            int page,
            int size,
            Map<Status, Long> statusCounts) {}

    public record AdminAttachment(Long id, String url, int width, int height) {}

    public record AdminDetail(
            Long id,
            Type type,
            Area area,
            Source source,
            Integer satisfaction,
            boolean lowScore,
            String title,
            String content,
            Status status,
            Instant createdAt,
            Instant readAt,
            Instant statusChangedAt,
            Long authorId,
            String authorName,
            String authorRole,
            String authorLevel,
            String authorPlan,
            Instant authorSince,
            String orgName,
            boolean allowContact,
            /** Chỉ có khi người gửi cho phép liên hệ (FBK-18). */
            String authorEmail,
            Map<String, Object> techInfo,
            List<AdminAttachment> attachments,
            List<ReplyDto> replies,
            String internalNote) {}

    public record UnreadCount(long count) {}

    public record StatusChangeRequest(
            @NotEmpty @Size(max = 200) List<Long> ids,
            @NotNull Status status,
            @Size(max = 1000) String explanation) {}

    public record MarkReadRequest(@NotEmpty @Size(max = 200) List<Long> ids) {}

    public record StatusChangeResult(int updated, int unchanged) {}

    public record ReplyRequest(@NotBlank @Size(max = 1000) String body) {}

    public record InternalNoteRequest(@Size(max = 2000) String note) {}
}
