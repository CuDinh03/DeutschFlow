package com.deutschflow.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * DTO for student to change their own password.
 * Requires the current password to verify identity before changing.
 */
public record ChangePasswordRequest(

        @NotBlank(message = "currentPassword is required")
        String currentPassword,

        @NotBlank(message = "newPassword is required")
        @Size(min = 6, message = "newPassword must be at least 6 characters")
        String newPassword
) {}
