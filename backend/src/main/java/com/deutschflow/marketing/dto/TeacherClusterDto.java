package com.deutschflow.marketing.dto;

/**
 * A cluster of ≥N non-org teachers who declared the same center (checklist D11) — a B2B org-sales
 * lead. {@code contactEmails} is the comma-joined list for founder follow-up.
 */
public record TeacherClusterDto(String centerName, int teacherCount, String contactEmails) {}
