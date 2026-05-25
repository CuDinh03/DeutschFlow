package com.deutschflow.curriculum.dto;

import java.util.List;

public record CurriculumUnit(
        String unitId,
        Integer order,
        String title,
        Boolean isReviewUnit,
        List<String> reviewOfUnits,
        List<String> canDo,
        List<String> skillTargets,
        List<String> grammarPoints,
        List<String> vocabTopics,
        List<String> checkpoints,
        List<Object> sessions
) {}

