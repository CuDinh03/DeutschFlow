package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.Date;

/**
 * Response of {@code POST /api/mock-exams/{examId}/start}.
 * <p>
 * Since V285 (audit C-02) BOTH branches — fresh attempt and resumed in-progress attempt —
 * return the full metadata ({@code exam_id}/{@code started_at}/{@code status}). The old
 * "reusing returns only {@code id}" omission was a resume bug: a second device had no way
 * to rebuild the attempt state. Additive fields ({@code server_now}, {@code deadline_at},
 * {@code remaining_seconds}, {@code draft}) let the client restore the autosaved draft and
 * drive the countdown from the server clock instead of resetting it on every reload.
 * <p>
 * {@code startedAt} is a {@link java.util.Date} (not {@code Instant}) so the jdbc
 * {@code java.sql.Timestamp} serializes byte-identically to the previous map.
 * {@code deadline_at}/{@code remaining_seconds} are absent when the exam has no time limit;
 * {@code draft} is absent when nothing was autosaved yet.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ExamStartDto(
        long id,
        @JsonProperty("exam_id") Long examId,
        @JsonProperty("started_at") Date startedAt,
        String status,
        @JsonProperty("sections_json") String sectionsJson,
        @JsonProperty("time_limit_minutes") Integer timeLimitMinutes,
        @JsonProperty("server_now") Instant serverNow,
        @JsonProperty("deadline_at") Instant deadlineAt,
        @JsonProperty("remaining_seconds") Long remainingSeconds,
        ExamDraftDto draft) {}
