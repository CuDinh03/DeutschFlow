package com.deutschflow.speaking.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

/**
 * Response of {@code POST /api/onboarding/mock-exam/evaluate} — a union of the success and error
 * branches, {@code @JsonInclude(NON_NULL)} so each emits exactly the legacy keys:
 * <ul>
 *   <li>success → {@code {estimated_cefr, radar_chart, top_errors, summary_vi, id}}</li>
 *   <li>400/500 → {@code {error}}</li>
 * </ul>
 * {@code radar_chart}/{@code top_errors} are the raw AI JSON kept loose as {@code Object} (the AI
 * schema is documented + prompt-enforced, but typing it rigidly would risk dropping AI-returned data).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MockExamEvalDto(
        @JsonProperty("estimated_cefr") String estimatedCefr,
        @JsonProperty("radar_chart") Object radarChart,
        @JsonProperty("top_errors") Object topErrors,
        @JsonProperty("summary_vi") String summaryVi,
        Long id,
        String error) {

    /** Build from the raw AI result map (parsed JSON + the persisted record {@code id}). */
    public static MockExamEvalDto success(Map<String, Object> r) {
        Object id = r.get("id");
        return new MockExamEvalDto(
                (String) r.get("estimated_cefr"),
                r.get("radar_chart"),
                r.get("top_errors"),
                (String) r.get("summary_vi"),
                id != null ? ((Number) id).longValue() : null,
                null);
    }

    public static MockExamEvalDto error(String message) {
        return new MockExamEvalDto(null, null, null, null, null, message);
    }
}
