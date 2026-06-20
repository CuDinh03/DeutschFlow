package com.deutschflow.speaking.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the byte-level JSON contract of the onboarding AI DTOs (placement / mock-exam evaluate /
 * sprechen-teil2 turn). Each replaced a raw {@code Map} whose dynamic AI parts (radar_chart,
 * top_errors, score) are kept loose as {@code Object} — this proves the typed envelope + conditional
 * keys + error union serialize identically to the legacy maps, with the loose parts passed through
 * unchanged (no data loss).
 */
class OnboardingAiDtoSerializationTest {

    private final ObjectMapper omd = new ObjectMapper().disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private void assertSameJson(Object dto, Map<String, Object> legacyMap) throws Exception {
        JsonNode fromDto = omd.readTree(omd.writeValueAsString(dto));
        JsonNode fromMap = omd.readTree(omd.writeValueAsString(legacyMap));
        assertThat(fromDto).isEqualTo(fromMap);
    }

    private Map<String, Object> radar() {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("grammar", 80);
        r.put("pronunciation", 75);
        r.put("vocabulary", 70);
        r.put("fluency", 85);
        return r;
    }

    private List<Map<String, Object>> topErrors() {
        return List.of(Map.of("code", "DATIV", "message", "Sai cách 3", "example", "dem -> den"));
    }

    // ── placement-tests/latest ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("PlacementTestDto (with radar+errors) == legacy LinkedHashMap")
    void placementWithNested() throws Exception {
        Date created = new Date(1_718_866_800_000L);
        var radar = radar();
        var errs = topErrors();
        Map<String, Object> legacy = new LinkedHashMap<>();
        legacy.put("id", 5L);
        legacy.put("transcript_de", "Ich heiße Anna.");
        legacy.put("estimated_cefr", "B1");
        legacy.put("created_at", created);
        legacy.put("radar_chart", radar);
        legacy.put("top_errors", errs);
        assertSameJson(new PlacementTestDto(5L, "Ich heiße Anna.", "B1", created, radar, errs), legacy);
    }

    @Test
    @DisplayName("PlacementTestDto (no stored radar/errors) omits those keys")
    void placementWithoutNested() throws Exception {
        Date created = new Date(1_718_866_800_000L);
        Map<String, Object> legacy = new LinkedHashMap<>();
        legacy.put("id", 5L);
        legacy.put("transcript_de", "Ich heiße Anna.");
        legacy.put("estimated_cefr", "B1");
        legacy.put("created_at", created);
        assertSameJson(new PlacementTestDto(5L, "Ich heiße Anna.", "B1", created, null, null), legacy);
    }

    // ── mock-exam/evaluate ───────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("MockExamEvalDto.success == legacy raw AI map (+ id)")
    void evaluateSuccess() throws Exception {
        Map<String, Object> raw = new LinkedHashMap<>();
        raw.put("estimated_cefr", "B1");
        raw.put("radar_chart", radar());
        raw.put("top_errors", topErrors());
        raw.put("summary_vi", "Năng lực B1, cần luyện cách 3.");
        raw.put("id", 7L);
        assertSameJson(MockExamEvalDto.success(raw), raw);
    }

    @Test
    @DisplayName("MockExamEvalDto.error == legacy Map.of(error)")
    void evaluateError() throws Exception {
        assertSameJson(MockExamEvalDto.error("Phân tích thất bại. Hãy thử lại sau."),
                Map.of("error", "Phân tích thất bại. Hãy thử lại sau."));
    }

    // ── mock-exam/sprechen-teil2/turn ────────────────────────────────────────────────────────

    @Test
    @DisplayName("SprechenTurnDto.from (USER_ASKING → continues) == legacy merged map")
    void turnContinues() throws Exception {
        Map<String, Object> eval = new LinkedHashMap<>();
        eval.put("score", 8);
        eval.put("feedback_vi", "Câu hỏi tốt.");
        eval.put("ai_response_de", "Ja, gern.");
        eval.put("next_stage", "USER_ANSWERING");
        eval.put("next_thema", "Reisen");
        eval.put("next_wort", "Zug");
        eval.put("next_ai_question", "Fährst du gern Zug?");
        assertSameJson(SprechenTurnDto.from(eval), eval);
    }

    @Test
    @DisplayName("SprechenTurnDto.from (finished) omits next_thema/wort/question")
    void turnFinished() throws Exception {
        Map<String, Object> eval = new LinkedHashMap<>();
        eval.put("score", 7);
        eval.put("feedback_vi", "Tốt.");
        eval.put("ai_response_de", "Verstehe.");
        eval.put("next_stage", "FINISHED");
        assertSameJson(SprechenTurnDto.from(eval), eval);
    }

    @Test
    @DisplayName("SprechenTurnDto.error == legacy Map.of(error)")
    void turnError() throws Exception {
        assertSameJson(SprechenTurnDto.error("Missing required fields"),
                Map.of("error", "Missing required fields"));
    }
}
