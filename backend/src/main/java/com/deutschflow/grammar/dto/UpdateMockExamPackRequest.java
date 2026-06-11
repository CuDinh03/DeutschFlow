package com.deutschflow.grammar.dto;

/**
 * Admin partial-update payload for a mock-exam pack (D3): only non-null fields are applied. Set
 * {@code active=false} to retire a pack (or use DELETE), {@code active=true} to re-publish it.
 */
public record UpdateMockExamPackRequest(
        String title,
        String descriptionVi,
        String cefrLevel,
        String examFormat,
        Boolean requiresPaid,
        Boolean active,
        Integer sortOrder
) {}
