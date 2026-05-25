package com.deutschflow.user.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * DTO for student to update their own basic profile info.
 * All fields are optional — only non-null values will be applied.
 */
public record UpdateProfileRequest(

        @Size(min = 2, max = 100, message = "displayName must be 2–100 characters")
        String displayName,

        /** Vietnamese phone number: 0xxxxxxxxx or +84xxxxxxxxx */
        @Pattern(regexp = "^(\\+84|0)[0-9]{8,9}$", message = "phoneNumber must be a valid Vietnamese number")
        String phoneNumber,

        /** UI locale: vi | en | de */
        @Pattern(regexp = "^(vi|en|de)$", message = "locale must be vi, en or de")
        String locale
) {}
