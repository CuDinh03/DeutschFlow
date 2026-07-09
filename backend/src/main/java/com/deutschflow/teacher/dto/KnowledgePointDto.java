package com.deutschflow.teacher.dto;

/** A lesson's knowledge point as returned to clients (from the sub-table, or a description fallback). */
public record KnowledgePointDto(
        Long id,
        int orderIndex,
        String text,
        String skillTag,
        String contentTag
) {}
