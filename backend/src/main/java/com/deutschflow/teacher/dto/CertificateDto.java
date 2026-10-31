package com.deutschflow.teacher.dto;

import java.time.Instant;

/**
 * Full co-branded certificate for rendering / public verification (D5).
 *
 * <p>Returned to the issuing teacher and from the public verify endpoint. The student name is
 * intentionally included — it is printed on the certificate. {@code orgName}/{@code orgLogoUrl}
 * are the center co-brand (null when the issuer has no org → default DeutschFlow branding).
 *
 * <p>{@code erased}: học viên đã xoá tài khoản, tên/điểm/nhận xét không còn; trang xác thực chỉ báo
 * "không còn hiệu lực". {@code orgLogoUrl} là URL đã ký vì bucket private.
 */
public record CertificateDto(
        String certificateCode,
        String verifyToken,
        String studentName,
        String cefrLevel,
        Integer score,
        String note,
        String orgName,
        String orgLogoUrl,
        String issuedByName,
        Instant issuedAt,
        boolean active,
        boolean erased
) {}
