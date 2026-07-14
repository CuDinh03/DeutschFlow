package com.deutschflow.teacher.dto;

/**
 * One Kann-Beschreibung in a create/update request. cefrLevel/skillTag are optional (nullable).
 *
 * <p>{@code id} identifies an ALREADY-SAVED statement. Sending it back lets the server update that row
 * in place; a null id means "new statement". This matters beyond tidiness: {@code student_competency}
 * references {@code can_do_statement} with ON DELETE CASCADE, so re-creating the statements on every
 * save (new ids) silently erases every student's self-assessment and grading-derived progress for the
 * lesson. Only statements the client stops sending are genuinely deleted.
 */
public record CanDoStatementInput(
        Long id,
        String text,
        String cefrLevel,
        String skillTag
) {}
