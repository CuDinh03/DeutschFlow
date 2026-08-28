package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.Date;

/**
 * 200 body of {@code PATCH /api/mock-exams/attempts/{attemptId}/draft}.
 * <p>
 * Besides the new lock token ({@code version}), every save echoes the server clock and the
 * server-computed deadline so the client can resync its countdown — the timer must follow
 * {@code started_at + time_limit_minutes} on the server, never a client-side reset.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ExamDraftSaveDto(
        long version,
        @JsonProperty("saved_at") Date savedAt,
        @JsonProperty("server_now") Instant serverNow,
        @JsonProperty("deadline_at") Instant deadlineAt,
        @JsonProperty("remaining_seconds") Long remainingSeconds) {}
