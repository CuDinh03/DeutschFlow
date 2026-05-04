package com.deutschflow.common.security;

import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceUnitTest {

    private static final String SECRET_32_PLUS = "abcdefghijklmnopqrstuvwxyz0123456789abcdef";

    @Test
    void generatesRoundTripAccessToken() {
        JwtService jwt = new JwtService(SECRET_32_PLUS, 3_600_000L);
        User u = User.builder()
                .id(9L).email("a@b.com").passwordHash("x").displayName("T")
                .role(User.Role.STUDENT)
                .build();
        String token = jwt.generateAccessToken(u);
        assertNotNull(token);
        assertEquals("a@b.com", jwt.extractEmail(token));
        assertTrue(jwt.isTokenValid(token));
    }

    @Test
    void rejectsTooShortSecret() {
        assertThrows(IllegalStateException.class, () -> new JwtService("short", 1000));
    }
}
