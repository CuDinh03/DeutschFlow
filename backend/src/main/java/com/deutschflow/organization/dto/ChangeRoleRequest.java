package com.deutschflow.organization.dto;

import jakarta.validation.constraints.NotBlank;

/** Body for PATCH /api/org/members/{userId}/role — new org-role (MANAGER | TEACHER). */
public record ChangeRoleRequest(@NotBlank String role) {}
