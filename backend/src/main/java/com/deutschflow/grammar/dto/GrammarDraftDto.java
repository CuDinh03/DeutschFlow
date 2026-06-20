package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Date;
import java.util.Map;

/**
 * A teacher's own draft exercise — element of {@code GET /api/grammar/syllabus/exercises/my-drafts}.
 * {@code createdAt} is a {@link Date} (timestamptz); keys mirror the prior map exactly.
 */
public record GrammarDraftDto(
        long id,
        @JsonProperty("topic_id") Long topicId,
        @JsonProperty("topic_title") String topicTitle,
        @JsonProperty("exercise_type") String exerciseType,
        Integer difficulty,
        @JsonProperty("question_json") String questionJson,
        String status,
        @JsonProperty("reject_reason") String rejectReason,
        @JsonProperty("created_at") Date createdAt) {

    public static GrammarDraftDto from(Map<String, Object> m) {
        return new GrammarDraftDto(
                ((Number) m.get("id")).longValue(),
                (Long) m.get("topic_id"),
                (String) m.get("topic_title"),
                (String) m.get("exercise_type"),
                (Integer) m.get("difficulty"),
                (String) m.get("question_json"),
                (String) m.get("status"),
                (String) m.get("reject_reason"),
                (Date) m.get("created_at"));
    }
}
