package com.deutschflow.curriculum.dto;

import java.util.List;
import java.util.Map;

public record CurriculumCourse(
        String courseId,
        String provider,
        Map<String, Object> source,
        String level,
        String version,
        List<CurriculumUnit> units,
        Map<String, List<String>> taxonomies,
        List<String> grammarInventory
) {}

