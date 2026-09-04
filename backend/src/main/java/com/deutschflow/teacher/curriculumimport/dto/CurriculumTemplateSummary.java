package com.deutschflow.teacher.curriculumimport.dto;

/** A template as listed in the wizard's picker. */
public record CurriculumTemplateSummary(
        String id,
        String title,
        String level,
        int chapterCount,
        int reviewCount,
        int defaultSessionsPerChapter,
        int defaultUnitsPerSession) {}
