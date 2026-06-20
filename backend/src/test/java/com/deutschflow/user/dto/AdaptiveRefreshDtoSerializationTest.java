package com.deutschflow.user.dto;

import com.deutschflow.user.service.WeakPointGrammarPlanInjector.InjectionResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the byte-level JSON contract of {@link AdaptiveRefreshDto}: it replaced the raw
 * {@code LinkedHashMap<String,Object>} on {@code POST /api/plan/me/adaptive-refresh}, so the keys MUST
 * stay identical and the nullable week/sessionIndex/errorCode MUST stay present-but-null (the web
 * client {@code lib/planApi.ts} types them as {@code number|null} / {@code string|null}).
 */
class AdaptiveRefreshDtoSerializationTest {

    private final ObjectMapper omd = new ObjectMapper().disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private void assertSameJson(Object dto, Map<String, Object> legacyMap) throws Exception {
        JsonNode fromDto = omd.readTree(omd.writeValueAsString(dto));
        JsonNode fromMap = omd.readTree(omd.writeValueAsString(legacyMap));
        assertThat(fromDto).isEqualTo(fromMap);
    }

    /** Mirrors the exact LinkedHashMap the controller built (insertion order; nulls put explicitly). */
    private Map<String, Object> legacy(boolean injected, String reason, String errorCode,
                                       Integer week, Integer sessionIndex) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("injected", injected);
        m.put("reason", reason);
        m.put("errorCode", errorCode);
        m.put("week", week);
        m.put("sessionIndex", sessionIndex);
        return m;
    }

    @Test
    @DisplayName("injected result == legacy map (all keys present)")
    void injectedEqualsLegacyMap() throws Exception {
        var r = new InjectionResult(true, "INJECTED", "DATIV", 2, 1);
        assertSameJson(AdaptiveRefreshDto.from(r), legacy(true, "INJECTED", "DATIV", 2, 1));
    }

    @Test
    @DisplayName("skip result keeps errorCode/week/sessionIndex:null (not omitted)")
    void skipKeepsNulls() throws Exception {
        var r = new InjectionResult(false, "NO_WEAK_POINTS", null, null, null);
        assertSameJson(AdaptiveRefreshDto.from(r), legacy(false, "NO_WEAK_POINTS", null, null, null));
    }
}
