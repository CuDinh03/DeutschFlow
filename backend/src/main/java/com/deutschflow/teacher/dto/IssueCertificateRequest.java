package com.deutschflow.teacher.dto;

/**
 * Teacher request to issue a co-branded certificate (D5) to a student in one of their classes.
 * {@code score} and {@code note} are optional; {@code cefrLevel} is required and validated server-side.
 */
public record IssueCertificateRequest(
        Long classId,
        Long studentId,
        String cefrLevel,
        Integer score,
        String note
) {}
