package com.deutschflow.teacher.dto;

import java.time.Instant;

/**
 * Chứng nhận hoàn thành khoá học của CHÍNH học viên (đợt 4A A+B+E). Có {@code verifyToken} vì học viên
 * là người giữ giấy và tự chia sẻ link xác thực. Không có điểm hay nhận xét: mở link là thấy đủ.
 */
public record StudentCertificateDto(
        String certificateCode,
        String verifyToken,
        String cefrLevel,
        String orgName,
        Instant issuedAt,
        boolean active
) {}
