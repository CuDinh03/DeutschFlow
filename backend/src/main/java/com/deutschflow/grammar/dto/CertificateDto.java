package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Date;
import java.util.Map;

/**
 * A CEFR certificate the student holds — element of {@code GET /api/certificates/me}.
 * Keys mirror the raw {@code cefr_certificates} columns (snake_case); nulls are kept (default
 * include) to match the prior {@code queryForList} map exactly. {@code issuedAt} is a
 * {@link Date} (timestamptz).
 */
public record CertificateDto(
        Long id,
        @JsonProperty("cefr_level") String cefrLevel,
        @JsonProperty("issued_at") Date issuedAt,
        @JsonProperty("exam_score") Integer examScore,
        @JsonProperty("certificate_code") String certificateCode,
        @JsonProperty("is_active") Boolean isActive) {

    public static CertificateDto from(Map<String, Object> m) {
        return new CertificateDto(
                m.get("id") == null ? null : ((Number) m.get("id")).longValue(),
                (String) m.get("cefr_level"),
                (Date) m.get("issued_at"),
                (Integer) m.get("exam_score"),
                (String) m.get("certificate_code"),
                (Boolean) m.get("is_active"));
    }
}
