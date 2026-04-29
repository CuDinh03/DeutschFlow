package com.deutschflow.user.dto;

import java.time.LocalDateTime;
import java.util.List;

public record ReviewDueResponse(
        int limit,
        long totalSeededItems,
        List<Item> items
) {
    public record Item(
            long id,
            String itemType,
            String itemRef,
            String prompt,
            int repetitions,
            int intervalDays,
            double easeFactor,
            LocalDateTime dueAt
    ) {
    }
}
