package com.deutschflow.user.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RegisterRequestTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    private boolean phoneHasViolation(String phone) {
        var req = new RegisterRequest("a@b.com", phone, "secret12", "Name", "vi");
        return !validator.validateProperty(req, "phoneNumber").isEmpty();
    }

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

    // --- phone is OPTIONAL (App Store 5.1.1(v)): omitted/empty must validate; a bad format must not ---

    @Test
    void nullPhonePassesValidation() {
        assertFalse(phoneHasViolation(null));
    }

    @Test
    void emptyPhonePassesValidation() {
        // The "^$|" alternative in the @Pattern lets an explicit empty string through so a client that
        // sends "" (rather than omitting the field) still registers; AuthService stores it as NULL.
        assertFalse(phoneHasViolation(""));
    }

    @Test
    void validVietnameseMobilePassesValidation() {
        assertFalse(phoneHasViolation("0912345678"));
    }

    @Test
    void malformedPhoneStillFailsValidation() {
        assertTrue(phoneHasViolation("0212345678")); // invalid leading prefix
        assertTrue(phoneHasViolation("091234567"));  // too short
        assertTrue(phoneHasViolation("not-a-number"));
    }
}
