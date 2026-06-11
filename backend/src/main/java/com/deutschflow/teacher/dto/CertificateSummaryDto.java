package com.deutschflow.teacher.dto;

import java.time.Instant;

/** Compact certificate row for the teacher's per-class list (D5). */
public record CertificateSummaryDto(
        Long id,
        String certificateCode,
        String verifyToken,
        String studentName,
        String cefrLevel,
        Integer score,
        Instant issuedAt,
        boolean active
) {}
