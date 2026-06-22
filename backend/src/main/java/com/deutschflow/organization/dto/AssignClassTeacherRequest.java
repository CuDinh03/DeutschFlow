package com.deutschflow.organization.dto;

import jakarta.validation.constraints.NotNull;

/** Body for POST /api/org/classes/{classId}/teachers — assign an org teacher (by user id) to the class. */
public record AssignClassTeacherRequest(@NotNull Long userId) {}
