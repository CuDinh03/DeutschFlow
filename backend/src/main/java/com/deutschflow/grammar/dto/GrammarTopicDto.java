package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Date;
import java.util.Map;

/**
 * Grammar syllabus topic with the user's progress — element of {@code GET /api/grammar/syllabus/topics}.
 * Keys mirror the raw {@code queryForList} columns (snake_case) exactly. {@code masteryPercent} is a
 * {@link Float} because the DB column is {@code real}; {@code lastPracticedAt} a {@link Date}
 * (timestamptz) — both keep the previous serialization byte-for-byte.
 */
public record GrammarTopicDto(
        long id,
        @JsonProperty("cefr_level") String cefrLevel,
        @JsonProperty("topic_code") String topicCode,
        @JsonProperty("title_de") String titleDe,
        @JsonProperty("title_vi") String titleVi,
        @JsonProperty("title_en") String titleEn,
        @JsonProperty("description_vi") String descriptionVi,
        @JsonProperty("sort_order") Integer sortOrder,
        @JsonProperty("exercises_done") Integer exercisesDone,
        @JsonProperty("exercises_correct") Integer exercisesCorrect,
        @JsonProperty("mastery_percent") Float masteryPercent,
        @JsonProperty("last_practiced_at") Date lastPracticedAt,
        @JsonProperty("total_exercises") Long totalExercises) {

    public static GrammarTopicDto from(Map<String, Object> m) {
        return new GrammarTopicDto(
                ((Number) m.get("id")).longValue(),
                (String) m.get("cefr_level"),
                (String) m.get("topic_code"),
                (String) m.get("title_de"),
                (String) m.get("title_vi"),
                (String) m.get("title_en"),
                (String) m.get("description_vi"),
                (Integer) m.get("sort_order"),
                (Integer) m.get("exercises_done"),
                (Integer) m.get("exercises_correct"),
                (Float) m.get("mastery_percent"),
                (Date) m.get("last_practiced_at"),
                (Long) m.get("total_exercises"));
    }
}
