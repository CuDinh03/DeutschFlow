package com.deutschflow.teacher.curriculumimport.dto;

import java.util.List;

/**
 * What a commit actually wrote. {@code replayed} is true when the call matched a previous commit's
 * idempotency key — the client sees the same counts as the original write and no new rows exist.
 */
public record CurriculumImportCommitResult(
        int modulesCreated,
        int lessonsCreated,
        List<Long> moduleIds,
        List<String> skippedModuleTitles,
        boolean replayed) {}
