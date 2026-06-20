package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Date;
import java.util.Map;

/**
 * An exercise awaiting admin review — element of {@code GET /api/grammar/syllabus/admin/pending}.
 */
public record GrammarPendingReviewDto(
        long id,
        @JsonProperty("topic_id") Long topicId,
        @JsonProperty("topic_title") String topicTitle,
        @JsonProperty("cefr_level") String cefrLevel,
        @JsonProperty("exercise_type") String exerciseType,
        Integer difficulty,
        @JsonProperty("question_json") String questionJson,
        String status,
        @JsonProperty("ai_generated") Boolean aiGenerated,
        @JsonProperty("created_by") Long createdBy,
        @JsonProperty("created_at") Date createdAt) {

    public static GrammarPendingReviewDto from(Map<String, Object> m) {
        return new GrammarPendingReviewDto(
                ((Number) m.get("id")).longValue(),
                (Long) m.get("topic_id"),
                (String) m.get("topic_title"),
                (String) m.get("cefr_level"),
                (String) m.get("exercise_type"),
                (Integer) m.get("difficulty"),
                (String) m.get("question_json"),
                (String) m.get("status"),
                (Boolean) m.get("ai_generated"),
                (Long) m.get("created_by"),
                (Date) m.get("created_at"));
    }
}
