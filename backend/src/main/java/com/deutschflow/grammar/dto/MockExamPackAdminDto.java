package com.deutschflow.grammar.dto;

import java.time.Instant;

/**
 * A mock-exam pack as seen by an ADMIN curator (D3). Unlike {@link MockExamPackDto} this exposes
 * the raw curation fields ({@code active}, {@code sortOrder}, {@code requiresPaid}) and the live
 * {@code examCount} the pack currently resolves to — 0 means the pack would render empty.
 */
public record MockExamPackAdminDto(
        Long id,
        String title,
        String descriptionVi,
        String cefrLevel,
        String examFormat,
        boolean requiresPaid,
        boolean active,
        int sortOrder,
        int examCount,
        Instant createdAt
) {}
