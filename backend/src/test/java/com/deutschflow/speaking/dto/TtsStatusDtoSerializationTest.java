package com.deutschflow.speaking.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the byte-level JSON contract of {@link TtsStatusDto}: it replaced the raw
 * {@code Map<String,Object>} returned by {@code EdgeTtsService#getUsageStats()} on
 * {@code GET /api/ai-speaking/tts/status}, so keys + null-handling MUST stay identical.
 */
class TtsStatusDtoSerializationTest {

    private final ObjectMapper omd = new ObjectMapper().disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private void assertSameJson(Object dto, Map<String, Object> legacyMap) throws Exception {
        JsonNode fromDto = omd.readTree(omd.writeValueAsString(dto));
        JsonNode fromMap = omd.readTree(omd.writeValueAsString(legacyMap));
        assertThat(fromDto).isEqualTo(fromMap);
    }

    /** Exact shape getUsageStats() builds (insertion order + Long counters + nullable String timestamps). */
    private Map<String, Object> legacy(boolean configured, String url, long req, long chars,
                                       long errors, long bytes, String first, String last) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("provider", "edge-tts");
        m.put("configured", configured);
        m.put("edgeTtsUrl", url);
        m.put("totalRequests", req);
        m.put("totalCharsSent", chars);
        m.put("totalErrors", errors);
        m.put("totalAudioBytes", bytes);
        m.put("firstRequestAt", first);
        m.put("lastRequestAt", last);
        return m;
    }

    @Test
    @DisplayName("active sidecar (non-null timestamps) == legacy getUsageStats map")
    void activeStatsEqualLegacyMap() throws Exception {
        var legacy = legacy(true, "https://tts.example.com", 12L, 3456L, 1L, 98765L,
                "2024-06-20T07:00:00Z", "2024-06-20T09:30:00Z");
        assertSameJson(TtsStatusDto.from(legacy), legacy);
    }

    @Test
    @DisplayName("fresh / not configured (null url + null timestamps) == legacy map (nulls kept)")
    void freshStatsKeepNulls() throws Exception {
        var legacy = legacy(false, null, 0L, 0L, 0L, 0L, null, null);
        assertSameJson(TtsStatusDto.from(legacy), legacy);
    }
}
