package com.deutschflow.vocabulary.dto;

import java.time.LocalDate;

public record WordTranslationCoverageResponse(
        LocalDate date,
        long totalWords,
        long wordsWithDe,
        long wordsWithVi,
        long wordsWithEn,
        long wordsWithAllLocales,
        double deCoveragePercent,
        double viCoveragePercent,
        double enCoveragePercent,
        double allLocalesCoveragePercent
) {
}
