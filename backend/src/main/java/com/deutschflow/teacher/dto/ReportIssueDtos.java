package com.deutschflow.teacher.dto;

import java.time.Instant;
import java.util.Map;

/**
 * Hợp đồng API của phiếu đánh giá gửi gia đình (PR-R2, thiết kế 10/09/2026). Gom vào một lớp vì các
 * record này chỉ có nghĩa cùng nhau; nơi dùng: {@code TeacherReportIssueController},
 * {@code OrgReportIssueController}, {@code PublicReportIssueController}, {@code StudentReportIssueController}.
 */
public final class ReportIssueDtos {

    private ReportIssueDtos() {}

    /** Thân {@code POST /api/teacher/classes/{classId}/students/{studentId}/report-issues}. */
    public record IssueReportRequest(
            /** {@code MIDTERM | FINAL} — bắt buộc. */
            String period,
            /** {@code vi | en | de}; bỏ trống = vi (R8). */
            String lang) {}

    /** Thân {@code POST /api/org/report-issues/{id}/revoke}. Lý do 5–300 ký tự, vào sổ hoạt động. */
    public record RevokeReportIssueRequest(String reason) {}

    /**
     * Một dòng phiếu cho giáo viên / giám đốc / học viên. {@code token} và {@code publicPath} CHỈ có khi
     * {@code status = ACTIVE} — link đã chết thì không phát lại cho ai. {@code verificationCode} (8 ký
     * tự đầu token, in trên giấy) luôn có để đối chiếu với bản PDF đã gửi, kể cả sau khi thu hồi.
     * {@code className} đọc từ ảnh chụp trong payload, không đọc tên hiện tại của lớp.
     */
    public record ReportIssueSummaryDto(
            Long id,
            Long classId,
            String className,
            Long studentId,
            String studentName,
            String period,
            String lang,
            /** {@code ACTIVE | EXPIRED | SUPERSEDED | REVOKED}. */
            String status,
            Instant issuedAt,
            String issuedByName,
            Instant tokenExpiresAt,
            Instant revokedAt,
            /** Mã: {@code SUPERSEDED | OWNER | MANAGER | TEACHER}; lý do văn tự ở sổ hoạt động. */
            String revokeReason,
            int viewCount,
            Instant lastViewedAt,
            String token,
            /** {@code /phieu/{token}?lang=…} — web ghép domain của chính nó. */
            String publicPath,
            String verificationCode) {}

    /** Dòng phiếu + nội dung đã đóng băng — kết quả phát hành, và "xem đúng bản đã gửi" của học viên (R6). */
    public record ReportIssueDto(ReportIssueSummaryDto issue, Map<String, Object> payload) {}

    /**
     * Trang công khai ({@code GET /api/public/report-issues/{token}}): chỉ những gì in trên phiếu.
     * KHÔNG id nội bộ, KHÔNG token (người gọi đã cầm), KHÔNG lượt xem.
     */
    public record PublicReportIssueDto(
            String period,
            String lang,
            Instant issuedAt,
            Instant tokenExpiresAt,
            String orgName,
            String orgLogoUrl,
            String studentName,
            String issuedByName,
            String verificationCode,
            Map<String, Object> payload) {}
}
