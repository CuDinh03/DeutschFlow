package com.deutschflow.organization.dto;

import java.time.Instant;

/**
 * Một dòng trong sổ chứng nhận toàn trung tâm (DEC-20) — bề mặt đọc của giám đốc/quản lý.
 *
 * <p>Khác {@code CertificateSummaryDto} (danh sách theo lớp của giáo viên) ở chỗ mang thêm lớp
 * (id + tên hiện tại của lớp) và người cấp, vì giám đốc nhìn CẢ trung tâm chứ không đứng trong
 * ngữ cảnh một lớp. {@code className} là tên hiện tại (không chụp lúc cấp) — lớp đã xoá ⇒ null.
 * Tên học viên là bản chụp in trên chứng nhận, đúng như mọi bề mặt khác của chứng nhận.
 * {@code erased}: học viên đã xoá tài khoản, giấy hết hiệu lực mà không ai thu hồi.
 */
public record OrgCertificateRowDto(
        Long id,
        String certificateCode,
        String verifyToken,
        Long classId,
        String className,
        Long studentUserId,
        String studentName,
        String cefrLevel,
        Integer score,
        Long issuedByUserId,
        String issuedByName,
        Instant issuedAt,
        boolean active,
        boolean erased
) {}
