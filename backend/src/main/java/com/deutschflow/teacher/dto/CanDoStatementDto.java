package com.deutschflow.teacher.dto;

/** A lesson's Kann-Beschreibung ("Ich kann …") as returned to clients (Phase 1e). */
public record CanDoStatementDto(
        Long id,
        int orderIndex,
        String cefrLevel,
        String skillTag,
        String text
) {}
