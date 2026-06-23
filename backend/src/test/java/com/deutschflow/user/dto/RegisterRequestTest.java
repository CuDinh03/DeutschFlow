package com.deutschflow.user.dto;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class RegisterRequestTest {

    @Test
    void trimsSurroundingWhitespaceFromEmail() {
        // Mirrors LoginRequest: whitespace must be stripped before @Email validation, otherwise a
        // pasted/autofilled email with a stray space 400s at the controller instead of registering.
        var req = new RegisterRequest("  New@X.com  ", "0912345678", "secret12", "New User", "vi");
        assertEquals("New@X.com", req.email());
    }

    @Test
    void nullEmailStaysNull() {
        var req = new RegisterRequest(null, "0912345678", "secret12", "New User", "vi");
        assertNull(req.email());
    }
}
