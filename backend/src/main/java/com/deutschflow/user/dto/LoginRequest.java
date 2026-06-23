package com.deutschflow.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(

        @Email(message = "Invalid email format")
        @NotBlank(message = "Email is required")
        String email,

        @NotBlank(message = "Password is required")
        String password
) {
    // Trim the email BEFORE Bean Validation runs. @Email rejects leading/trailing whitespace, so a
    // pasted/autofilled address with a stray space would 400 at the controller — never reaching the
    // case-insensitive lookup. The compact constructor runs during Jackson deserialization, so @Valid
    // then validates the already-trimmed value. (Case is normalized at lookup time, not here.)
    public LoginRequest {
        if (email != null) {
            email = email.trim();
        }
    }
}
