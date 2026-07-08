package com.deutschflow.teacher.dto;

/** One Kann-Beschreibung in a create/update request. cefrLevel/skillTag are optional (nullable). */
public record CanDoStatementInput(
        String text,
        String cefrLevel,
        String skillTag
) {}
