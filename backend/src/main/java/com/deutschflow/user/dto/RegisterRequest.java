package com.deutschflow.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(

        @Email(message = "Invalid email format")
        @NotBlank(message = "Email is required")
        String email,

        // Phone is OPTIONAL (App Store 5.1.1(v): a non-core field cannot be forced at sign-up). When
        // provided it must be a valid VN mobile number; empty/blank is accepted and stored as NULL by
        // AuthService.register. The "^$|" alternative lets the empty string through @Pattern.
        @Pattern(regexp = "^$|^0[35789]\\d{8}$",
                message = "Số điện thoại không hợp lệ (VD: 0912345678, phải là số VN 10 chữ số)")
        String phoneNumber,

        @NotBlank(message = "Password is required")
        @Size(min = 6, max = 100, message = "Password must be between 6 and 100 characters")
        String password,

        @NotBlank(message = "Display name is required")
        @Size(min = 2, max = 100, message = "Display name must be between 2 and 100 characters")
        String displayName,

        @Pattern(regexp = "^(vi|en|de)$", message = "Locale must be one of: vi, en, de")
        String locale
) {
    // Trim the email BEFORE Bean Validation runs, mirroring LoginRequest. @Email rejects
    // leading/trailing whitespace, so a pasted/autofilled address with a stray space would 400
    // at the controller instead of registering. AuthService.register lowercases at write time.
    public RegisterRequest {
        if (email != null) {
            email = email.trim();
        }
    }
}
