package com.deutschflow.user.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Request DTO for admin to directly update a user's basic profile info.
 * No OTP required — admin override. All fields optional.
 */
public record AdminUpdateProfileRequest(

        @Size(min = 2, max = 100, message = "displayName must be 2–100 characters")
        String displayName,

        @Pattern(regexp = "^(\\+84|0)[0-9]{8,9}$", message = "phoneNumber must be a valid Vietnamese number")
        String phoneNumber
) {}
