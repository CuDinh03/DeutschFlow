package com.deutschflow.organization.dto;

/**
 * A "free teacher" (B2B model §4 decision 4): a {@code User(role=TEACHER)} with NO ACTIVE org
 * membership (derived — {@code users.org_id IS NULL}). No flag/table. Platform-admin lists these
 * to recruit/assign them to a center.
 */
public record FreeTeacherDto(
        Long userId,
        String email,
        String displayName
) {}
