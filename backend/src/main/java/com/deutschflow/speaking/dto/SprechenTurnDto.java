package com.deutschflow.speaking.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

/**
 * Response of {@code POST /api/onboarding/mock-exam/sprechen-teil2/turn} — a union, {@code @JsonInclude(NON_NULL)}
 * so each branch emits exactly the legacy keys:
 * <ul>
 *   <li>turn continues (USER_ASKING) → {@code {score, feedback_vi, ai_response_de, next_stage,
 *       next_thema, next_wort, next_ai_question}}</li>
 *   <li>turn finishes → {@code {score, feedback_vi, ai_response_de, next_stage:"FINISHED"}}</li>
 *   <li>400/500 → {@code {error}}</li>
 * </ul>
 * {@code score} is the AI 0-10 grade kept loose as {@code Object} (the model may emit an int or a
 * decimal — typing it rigidly would risk a {@code ClassCastException} on drift).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record SprechenTurnDto(
        Object score,
        @JsonProperty("feedback_vi") String feedbackVi,
        @JsonProperty("ai_response_de") String aiResponseDe,
        @JsonProperty("next_stage") String nextStage,
        @JsonProperty("next_thema") String nextThema,
        @JsonProperty("next_wort") String nextWort,
        @JsonProperty("next_ai_question") String nextAiQuestion,
        String error) {

    /** Build from the merged evaluation map (AI {score, feedback_vi, ai_response_de} + controller next_* keys). */
    public static SprechenTurnDto from(Map<String, Object> e) {
        return new SprechenTurnDto(
                e.get("score"),
                (String) e.get("feedback_vi"),
                (String) e.get("ai_response_de"),
                (String) e.get("next_stage"),
                (String) e.get("next_thema"),
                (String) e.get("next_wort"),
                (String) e.get("next_ai_question"),
                null);
    }

    public static SprechenTurnDto error(String message) {
        return new SprechenTurnDto(null, null, null, null, null, null, null, message);
    }
}
