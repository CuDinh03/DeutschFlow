package com.deutschflow.organization.dto;

/** Body for PATCH /api/org/members/{userId}/role — new org-role (MANAGER | TEACHER). */
public record ChangeRoleRequest(String role) {}
