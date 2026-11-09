package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Date;
import java.util.List;

/**
 * Live autosaved draft of an in-progress mock exam attempt, embedded in
 * {@link ExamStartDto} when one exists (V285, audit C-02).
 * <p>
 * {@code answersJson} is the raw JSON string ({@code {questionId: answer}}) exactly as the
 * client last saved it — same string-passthrough idiom as {@code sections_json}.
 * {@code savedAt} is a {@link Date} for the same jdbc-Timestamp serialization reason as
 * {@code ExamStartDto.startedAt}.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ExamDraftDto(
        @JsonProperty("answers_json") String answersJson,
        @JsonProperty("section_index") Integer sectionIndex,
        @JsonProperty("question_index") Integer questionIndex,
        long version,
        @JsonProperty("saved_at") Date savedAt,
        /* B3 (V373): câu đã "đánh dấu xem lại" — null thì bỏ khỏi JSON (NON_NULL). */
        List<String> flags) {
    public ExamDraftDto(String answersJson, Integer sectionIndex, Integer questionIndex, long version, Date savedAt) {
        this(answersJson, sectionIndex, questionIndex, version, savedAt, null);
    }
}
