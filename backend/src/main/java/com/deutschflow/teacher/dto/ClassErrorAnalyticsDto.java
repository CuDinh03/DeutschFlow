package com.deutschflow.teacher.dto;

public record ClassErrorAnalyticsDto(
        String errorCode,
        Long count
) {}
