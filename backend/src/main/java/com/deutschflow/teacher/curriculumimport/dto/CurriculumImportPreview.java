package com.deutschflow.teacher.curriculumimport.dto;

import java.util.List;

/**
 * The reviewable draft a teacher confirms before anything is written. Produced by a preview job and
 * returned as the job's result payload; NOTHING in here is persisted until commit.
 *
 * <p>{@code source} says how the draft was derived: {@code TEMPLATE} (a managed curriculum template)
 * or {@code OCR} (local OCR of the document's contents pages). {@code warnings} carries every point
 * the importer was not certain about, so the teacher fixes it in the preview rather than discovering
 * it after import.
 */
public record CurriculumImportPreview(
        Long sourceMaterialId,
        String sourceFileName,
        String detectedTitle,
        String detectedLevel,
        String source,
        List<String> warnings,
        List<DraftModule> modules) {

    public static final String SOURCE_TEMPLATE = "TEMPLATE";
    public static final String SOURCE_OCR = "OCR";
}
