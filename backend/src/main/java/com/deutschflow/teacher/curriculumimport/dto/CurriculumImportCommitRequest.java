package com.deutschflow.teacher.curriculumimport.dto;

import java.util.List;

/**
 * The teacher-approved draft, sent back for writing.
 *
 * <p>{@code idempotencyKey} is generated once by the client when the wizard opens its commit step and
 * reused verbatim on every retry, so a request that timed out mid-write cannot create a second copy
 * of the same curriculum.
 *
 * <p>{@code onDuplicateModule} says what to do when a module of the same title already exists in the
 * class: {@code FAIL} (default — report and let the teacher decide), {@code SKIP} (leave the existing
 * module untouched and import the rest) or {@code RENAME} (import under a suffixed title). Nothing
 * ever overwrites an existing module or lesson.
 */
public record CurriculumImportCommitRequest(
        Long sourceMaterialId,
        String idempotencyKey,
        String onDuplicateModule,
        List<DraftModule> modules) {

    public static final String ON_DUPLICATE_FAIL = "FAIL";
    public static final String ON_DUPLICATE_SKIP = "SKIP";
    public static final String ON_DUPLICATE_RENAME = "RENAME";
}
