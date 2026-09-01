package com.deutschflow.teacher.curriculumimport.dto;

import java.time.LocalDate;

/**
 * Import settings chosen in the wizard. Every field is nullable on the wire so an older client that
 * omits one still gets the documented default from {@link #normalized()}; validation of the values
 * themselves lives in the service (a bad value is a 400, never a silent clamp to something the
 * teacher did not ask for).
 *
 * @param templateId  managed template to expand, or null to read the material's own contents pages
 * @param materialId  library material this import is sourced from (required — the PDF is stored once)
 * @param startDate   optional; when null every draft lesson keeps {@code plannedDate = null}
 */
public record CurriculumImportConfig(
        String templateId,
        Long materialId,
        String cefrLevel,
        Integer sessionsPerChapter,
        Integer estimatedUnitsPerSession,
        Boolean separateReviewSessions,
        Boolean deepScan,
        LocalDate startDate) {

    public static final String DEFAULT_CEFR = "A1";
    public static final int DEFAULT_SESSIONS_PER_CHAPTER = 3;
    public static final int DEFAULT_UNITS_PER_SESSION = 4;

    /** This config with every unset field replaced by its documented default. */
    public CurriculumImportConfig normalized() {
        return new CurriculumImportConfig(
                templateId,
                materialId,
                cefrLevel == null || cefrLevel.isBlank() ? DEFAULT_CEFR : cefrLevel.trim().toUpperCase(),
                sessionsPerChapter == null ? DEFAULT_SESSIONS_PER_CHAPTER : sessionsPerChapter,
                estimatedUnitsPerSession == null ? DEFAULT_UNITS_PER_SESSION : estimatedUnitsPerSession,
                separateReviewSessions == null || separateReviewSessions,
                deepScan != null && deepScan,
                startDate);
    }
}
