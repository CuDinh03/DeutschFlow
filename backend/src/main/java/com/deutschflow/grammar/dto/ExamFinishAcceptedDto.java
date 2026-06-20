package com.deutschflow.grammar.dto;

/**
 * 202 Accepted body of {@code POST /api/mock-exams/attempts/{attemptId}/finish}.
 * <p>
 * Scoring runs asynchronously; the client polls {@code GET /api/async-jobs/{jobId}} for the result
 * (the web app currently re-fetches {@code /attempts/{id}/result} instead). Keys match the prior
 * {@code Map.of("jobId", "status", "attemptId")} exactly.
 */
public record ExamFinishAcceptedDto(String jobId, String status, long attemptId) {}
