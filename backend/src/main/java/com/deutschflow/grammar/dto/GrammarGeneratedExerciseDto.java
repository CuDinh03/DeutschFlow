package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

/**
 * A freshly AI-generated draft exercise — element of
 * {@code POST /api/grammar/syllabus/topics/{topicId}/generate} (teacher/admin).
 */
public record GrammarGeneratedExerciseDto(
        long id,
        @JsonProperty("exercise_type") String exerciseType,
        Integer difficulty,
        String status,
        @JsonProperty("question_json") String questionJson) {

    public static GrammarGeneratedExerciseDto from(Map<String, Object> m) {
        return new GrammarGeneratedExerciseDto(
                ((Number) m.get("id")).longValue(),
                (String) m.get("exercise_type"),
                (Integer) m.get("difficulty"),
                (String) m.get("status"),
                (String) m.get("question_json"));
    }
}
