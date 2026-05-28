package com.deutschflow.vocabulary.dto;

public record RecordReviewRequest(
        Long wordId,
        Integer confidence
) {}
