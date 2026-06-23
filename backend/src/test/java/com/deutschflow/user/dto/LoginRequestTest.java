package com.deutschflow.user.dto;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class LoginRequestTest {

    @Test
    void trimsSurroundingWhitespaceFromEmail() {
        // Whitespace must be stripped before @Email validation, otherwise a pasted/autofilled email
        // with a stray space 400s at the controller instead of logging in.
        var req = new LoginRequest("  User@X.com  ", "secret12");
        assertEquals("User@X.com", req.email());
    }

    @Test
    void nullEmailStaysNull() {
        var req = new LoginRequest(null, "secret12");
        assertNull(req.email());
    }
}
