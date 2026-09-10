package com.deutschflow.user.dto;

import com.deutschflow.common.security.PasswordPolicy;
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
        @Size(min = PasswordPolicy.MIN_LENGTH,
               message = "newPassword must be at least 8 characters")
        String newPassword
) {}
