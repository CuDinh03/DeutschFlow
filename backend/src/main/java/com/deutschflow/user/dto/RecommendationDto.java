package com.deutschflow.user.dto;

import java.util.List;

public record RecommendationDto(
        List<RecommendationItem> items
) {
    public record RecommendationItem(
            String type,
            String title,
            String description,
            String priority,
            String actionUrl
    ) {}
}
