package com.deutschflow.interview.dto;

public record InterviewRubricUpdateRequest(
        String criteriaJson,
        String weightJson
) {}
