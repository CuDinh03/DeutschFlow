package com.deutschflow.grammar.dto;

/** A mock-exam pack in the catalog (D3). {@code locked} = requires a paid plan the user lacks. */
public record MockExamPackDto(
        Long id,
        String title,
        String descriptionVi,
        String cefrLevel,
        String examFormat,
        int examCount,
        boolean requiresPaid,
        boolean locked
) {}
