package com.deutschflow.speaking.dto;

import java.util.List;

public record TodayRecommendedDto(
        String href,
        String topic,
        String cefrLevel,
        List<String> focusOrStructures
) {
}
