package com.deutschflow.payment.controller;

import com.deutschflow.payment.apple.AppleIapService.AppleActivationResult;
import com.deutschflow.payment.controller.AppleIapController.AppleErrorResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the byte-level JSON contract of the AppleIap typing round. {@code /verify} and {@code /sync}
 * flipped from {@code ResponseEntity<?>} to {@code ResponseEntity<AppleActivationResult>}; the error
 * branch moved from an inline {@code Map.of("error", …)} to {@link AppleErrorResponse}. The bodies the
 * client sees MUST stay identical.
 */
class AppleIapDtoSerializationTest {

    // Same config as the app (jackson-datatype-jsr310 + write-dates-as-timestamps:false), so the Instant
    // endsAt serializes to the same ISO string both sides; the assertion then proves keys/values/nulls match.
    private final ObjectMapper omd = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private void assertSameJson(Object dto, Map<String, Object> legacyMap) throws Exception {
        JsonNode fromDto = omd.readTree(omd.writeValueAsString(dto));
        JsonNode fromMap = omd.readTree(omd.writeValueAsString(legacyMap));
        assertThat(fromDto).isEqualTo(fromMap);
    }

    @Test
    @DisplayName("AppleErrorResponse == legacy Map.of(\"error\", msg)")
    void errorBodyEqualsLegacyMap() throws Exception {
        assertSameJson(new AppleErrorResponse("Apple IAP is not configured on this server."),
                Map.of("error", "Apple IAP is not configured on this server."));
        assertSameJson(new AppleErrorResponse("Invalid Apple transaction."),
                Map.of("error", "Invalid Apple transaction."));
    }

    @Test
    @DisplayName("AppleActivationResult keeps planCode + endsAt keys (subscription with expiry)")
    void activationResultEqualsLegacyMap() throws Exception {
        Instant endsAt = Instant.ofEpochMilli(1_718_866_800_000L);
        Map<String, Object> legacy = new LinkedHashMap<>();
        legacy.put("planCode", "PRO_MONTHLY");
        legacy.put("endsAt", endsAt);
        assertSameJson(new AppleActivationResult("PRO_MONTHLY", endsAt), legacy);
    }

    @Test
    @DisplayName("AppleActivationResult keeps endsAt:null (non-expiring entitlement) — not omitted")
    void activationResultKeepsNullEndsAt() throws Exception {
        Map<String, Object> legacy = new LinkedHashMap<>();
        legacy.put("planCode", "PRO_LIFETIME");
        legacy.put("endsAt", null);
        assertSameJson(new AppleActivationResult("PRO_LIFETIME", null), legacy);
    }
}
