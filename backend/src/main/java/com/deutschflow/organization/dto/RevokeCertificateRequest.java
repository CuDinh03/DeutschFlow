package com.deutschflow.organization.dto;

/**
 * Thân {@code POST /api/org/certificates/{id}/revoke} (DEC-20). Lý do BẮT BUỘC (5–300 ký tự sau
 * khi cắt khoảng trắng) — thu hồi là hành động không hoàn tác lên một giấy tờ đã trao cho học
 * viên, nên phải có lý do đọc được trong sổ hoạt động; kiểm ở service.
 */
public record RevokeCertificateRequest(String reason) {}
