package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the byte-level JSON contract of the certificate DTOs. {@code /me} keeps nulls
 * (default include); {@code /claim} is a NON_NULL union whose four branches must each emit exactly
 * the keys the old map did (the web client reads alreadyHas/justIssued on success, error on failure).
 */
class CertificateDtoSerializationTest {

    private final ObjectMapper omd = new ObjectMapper().disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private void assertSameJson(Object dto, Map<String, Object> legacy) throws Exception {
        JsonNode a = omd.readTree(omd.writeValueAsString(dto));
        JsonNode b = omd.readTree(omd.writeValueAsString(legacy));
        assertThat(a).isEqualTo(b);
    }

    @Test
    @DisplayName("CertificateDto (/me) == legacy map (snake_case, Date issued_at, nulls kept)")
    void meRowEqualsLegacy() throws Exception {
        Map<String, Object> legacy = new LinkedHashMap<>();
        legacy.put("id", 5L);
        legacy.put("cefr_level", "B1");
        legacy.put("issued_at", new Date(1_718_866_800_000L));
        legacy.put("exam_score", 82);
        legacy.put("certificate_code", "DF-B1-2026-00018");
        legacy.put("is_active", true);
        assertSameJson(CertificateDto.from(new LinkedHashMap<>(legacy)), legacy);
    }

    @Test
    @DisplayName("/claim already-held == {id, certificate_code, alreadyHas}")
    void claimExisting() throws Exception {
        Map<String, Object> legacy = new LinkedHashMap<>();
        legacy.put("id", 5L);
        legacy.put("certificate_code", "DF-B1-2026-00018");
        legacy.put("alreadyHas", true);
        assertSameJson(CertificateClaimDto.existing(5L, "DF-B1-2026-00018"), legacy);
    }

    @Test
    @DisplayName("/claim just-issued == {id, cefr_level, issued_at, exam_score, certificate_code, justIssued}")
    void claimIssued() throws Exception {
        Date issued = new Date(1_718_866_800_000L);
        Map<String, Object> legacy = new LinkedHashMap<>();
        legacy.put("id", 5L);
        legacy.put("cefr_level", "B1");
        legacy.put("issued_at", issued);
        legacy.put("exam_score", 82);
        legacy.put("certificate_code", "DF-B1-2026-00018");
        legacy.put("justIssued", true);
        assertSameJson(CertificateClaimDto.issued(5L, "DF-B1-2026-00018", "B1", issued, 82), legacy);
    }

    @Test
    @DisplayName("/claim 400 == {error, requirement}; 500 == {error}")
    void claimErrors() throws Exception {
        Map<String, Object> notEligible = new LinkedHashMap<>();
        notEligible.put("error", "Chưa pass mock exam B1");
        notEligible.put("requirement", "Cần đạt ≥ 60 điểm trong bài thi mock Goethe B1");
        assertSameJson(CertificateClaimDto.error("Chưa pass mock exam B1",
                "Cần đạt ≥ 60 điểm trong bài thi mock Goethe B1"), notEligible);

        Map<String, Object> failure = new LinkedHashMap<>();
        failure.put("error", "Không thể cấp chứng chỉ");
        assertSameJson(CertificateClaimDto.error("Không thể cấp chứng chỉ", null), failure);
    }
}
