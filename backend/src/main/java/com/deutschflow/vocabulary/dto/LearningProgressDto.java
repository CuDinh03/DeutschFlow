package com.deutschflow.vocabulary.dto;

public record LearningProgressDto(
        Integer totalWords,
        Integer masteredWords,
        Integer reviewingWords,
        Integer learningWords,
        Double retentionRate,
        Long wordsDueForReview
) {}
