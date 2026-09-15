package com.deutschflow.organization.dto;

import java.time.Instant;

/**
 * DTO cho đường trung tâm xem/sửa người giám hộ và ghi/thu hồi phiếu đồng ý của một học viên
 * (D1/R11, owner chốt 10/09/2026 — {@code OrgGuardianConsentController}).
 *
 * <p>Là DTO của HTTP, ánh xạ sang {@code GuardianDraft}/{@code ConsentDraft} ở service — đúng điều
 * javadoc {@code GuardianDraft} đã hẹn: hình dạng payload ngoài đổi thì không kéo theo chữ ký của
 * tầng nghiệp vụ. Enum nhận dạng CHUỖI để câu báo lỗi là tiếng Việt đọc được thay vì
 * {@code HttpMessageNotReadableException} của Jackson.
 */
public final class OrgGuardianConsentDtos {

    /** Một người giám hộ — đủ thông tin liên lạc, vì người đọc là quản trị của chính trung tâm. */
    public record GuardianDto(
            Long id,
            String fullName,
            String relationship,
            String phone,
            String email,
            boolean primary,
            Instant createdAt,
            Instant updatedAt
    ) {}

    /**
     * Thêm hoặc sửa người giám hộ. {@code primary} null = giữ nguyên khi sửa, {@code true} khi thêm
     * người đầu tiên (service quyết, xem {@code OrgGuardianConsentService}).
     */
    public record GuardianRequest(
            String fullName,
            String relationship,
            String phone,
            String email,
            Boolean primary
    ) {}

    /**
     * Một dòng trong sổ đồng ý. {@code recordedByName} giải từ {@code users} lúc đọc để màn hình nói
     * "ai ghi" bằng tên chứ không phải một con số — sổ này là bằng chứng, người đọc sáu tháng sau
     * không tra id bằng tay được.
     */
    public record ConsentDto(
            Long id,
            String scope,
            String action,
            String method,
            Long guardianId,
            String guardianName,
            String termsVersion,
            Instant effectiveAt,
            Long recordedByUserId,
            String recordedByName,
            String note,
            Instant createdAt
    ) {}

    /**
     * Ghi thêm một dòng vào sổ đồng ý. KHÔNG có {@code termsVersion}: máy chủ là bên duy nhất biết
     * điều khoản đang hiệu lực ({@code MinorConsentTerms}).
     *
     * @param effectiveAt lúc đồng ý/thu hồi THẬT (ngày ký giấy); null = bây giờ
     */
    public record ConsentRequest(
            String scope,
            String action,
            String method,
            Long guardianId,
            Instant effectiveAt,
            String note
    ) {}

    /**
     * Tóm tắt tình trạng chưa-thành-niên của một học viên cho màn chi tiết — KHÔNG có ngày sinh thô,
     * chỉ nhóm tuổi (căn cứ của mọi hạn chế) và trạng thái đồng ý ghi âm (thứ đang khoá/mở phần nói).
     */
    public record MinorSummary(
            String minorStatus,
            boolean birthDateRecorded,
            String audioConsentState,
            int guardianCount
    ) {}

    private OrgGuardianConsentDtos() {}
}
