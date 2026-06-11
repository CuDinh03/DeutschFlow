package com.deutschflow.grammar.dto;

/**
 * Admin payload to create a mock-exam pack (D3). {@code title} and {@code cefrLevel} are required;
 * {@code examFormat} defaults to {@code GOETHE}, {@code requiresPaid} to {@code true}, and
 * {@code sortOrder} to {@code 0} when omitted.
 */
public record CreateMockExamPackRequest(
        String title,
        String descriptionVi,
        String cefrLevel,
        String examFormat,
        Boolean requiresPaid,
        Integer sortOrder
) {}
