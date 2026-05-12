package com.deutschflow.news.dto;

public record NewsItemDto(
        String title,
        String summary,
        String url,
        String publishedAt,
        String sourceName,
        String sourceType
) {}
