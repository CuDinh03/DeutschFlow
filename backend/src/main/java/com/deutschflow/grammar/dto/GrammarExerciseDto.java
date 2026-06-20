package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

/**
 * An approved grammar exercise — element of {@code GET /api/grammar/syllabus/topics/{topicId}/exercises}.
 * {@code questionJson} is a raw JSON <em>string</em> the client parses (answer key stays server-side).
 */
public record GrammarExerciseDto(
        long id,
        @JsonProperty("exercise_type") String exerciseType,
        Integer difficulty,
        @JsonProperty("question_json") String questionJson) {

    public static GrammarExerciseDto from(Map<String, Object> m) {
        return new GrammarExerciseDto(
                ((Number) m.get("id")).longValue(),
                (String) m.get("exercise_type"),
                (Integer) m.get("difficulty"),
                (String) m.get("question_json"));
    }
}
