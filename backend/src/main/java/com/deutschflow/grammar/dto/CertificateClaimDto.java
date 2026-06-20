package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Date;

/**
 * Response of {@code POST /api/certificates/claim} — a union of the four legacy outcomes, with
 * {@code @JsonInclude(NON_NULL)} so each branch emits exactly the keys the old map did:
 * <ul>
 *   <li>already held  → {@code {id, certificate_code, alreadyHas}}</li>
 *   <li>just issued   → {@code {id, cefr_level, issued_at, exam_score, certificate_code, justIssued}}</li>
 *   <li>400 not eligible → {@code {error, requirement}}</li>
 *   <li>500 failure   → {@code {error}}</li>
 * </ul>
 * The web client reads {@code alreadyHas}/{@code justIssued} on success and {@code error} on failure.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CertificateClaimDto(
        Long id,
        @JsonProperty("certificate_code") String certificateCode,
        @JsonProperty("cefr_level") String cefrLevel,
        @JsonProperty("issued_at") Date issuedAt,
        @JsonProperty("exam_score") Integer examScore,
        Boolean alreadyHas,
        Boolean justIssued,
        String error,
        String requirement) {

    public static CertificateClaimDto existing(long id, String certificateCode) {
        return new CertificateClaimDto(id, certificateCode, null, null, null, true, null, null, null);
    }

    public static CertificateClaimDto issued(long id, String certificateCode, String cefrLevel,
                                             Date issuedAt, Integer examScore) {
        return new CertificateClaimDto(id, certificateCode, cefrLevel, issuedAt, examScore, null, true, null, null);
    }

    public static CertificateClaimDto error(String error, String requirement) {
        return new CertificateClaimDto(null, null, null, null, null, null, null, error, requirement);
    }
}
