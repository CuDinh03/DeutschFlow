package com.deutschflow.user.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AuthRateLimiterServiceUnitTest {

    /** Small deterministic limits: login 3/60s, register 2/600s, refresh 4/60s, password-reset 2/900s. */
    private AuthRateLimiterService newService() {
        return new AuthRateLimiterService(3, 60, 2, 600, 4, 60, 2, 900);
    }

    @Test
    @DisplayName("register allows up to max, then blocks the next attempt from the same IP")
    void register_allowsUpToMaxThenBlocks() {
        AuthRateLimiterService service = newService();

        assertTrue(service.allowRegister("1.1.1.1"), "1st register allowed");
        assertTrue(service.allowRegister("1.1.1.1"), "2nd register allowed (== max)");
        assertFalse(service.allowRegister("1.1.1.1"), "3rd register blocked (> max=2)");
    }

    @Test
    @DisplayName("register limit is isolated per IP")
    void register_isolatesByIp() {
        AuthRateLimiterService service = newService();

        assertTrue(service.allowRegister("1.1.1.1"));
        assertTrue(service.allowRegister("1.1.1.1"));
        assertFalse(service.allowRegister("1.1.1.1"));

        // A different IP has its own independent bucket.
        assertTrue(service.allowRegister("2.2.2.2"));
    }

    @Test
    @DisplayName("login limit is keyed by IP + email")
    void login_keyedByIpAndEmail() {
        AuthRateLimiterService service = newService();

        assertTrue(service.allow("9.9.9.9", "a@x.com"));
        assertTrue(service.allow("9.9.9.9", "a@x.com"));
        assertTrue(service.allow("9.9.9.9", "a@x.com"));
        assertFalse(service.allow("9.9.9.9", "a@x.com"), "4th login blocked (> max=3)");

        // Same IP, different email → separate bucket.
        assertTrue(service.allow("9.9.9.9", "b@x.com"));
    }

    @Test
    @DisplayName("login key is case-insensitive on email")
    void login_emailCaseInsensitive() {
        AuthRateLimiterService service = newService();

        assertTrue(service.allow("8.8.8.8", "User@X.com"));
        assertTrue(service.allow("8.8.8.8", "user@x.com"));
        assertTrue(service.allow("8.8.8.8", "USER@X.COM"));
        assertFalse(service.allow("8.8.8.8", "user@x.com"), "case variants share one bucket");
    }

    @Test
    @DisplayName("refresh allows up to max, then blocks")
    void refresh_allowsUpToMaxThenBlocks() {
        AuthRateLimiterService service = newService();

        for (int i = 0; i < 4; i++) {
            assertTrue(service.allowRefresh("3.3.3.3"), "refresh #" + (i + 1) + " allowed");
        }
        assertFalse(service.allowRefresh("3.3.3.3"), "5th refresh blocked (> max=4)");
    }

    @Test
    @DisplayName("password reset allows up to max then blocks, keyed by IP + email")
    void passwordReset_allowsUpToMaxThenBlocks() {
        AuthRateLimiterService service = newService();

        assertTrue(service.allowPasswordReset("7.7.7.7", "a@x.com"), "1st reset allowed");
        assertTrue(service.allowPasswordReset("7.7.7.7", "a@x.com"), "2nd reset allowed (== max=2)");
        assertFalse(service.allowPasswordReset("7.7.7.7", "a@x.com"), "3rd reset blocked (> max=2)");

        // Same IP, different email → separate bucket.
        assertTrue(service.allowPasswordReset("7.7.7.7", "b@x.com"));
    }

    @Test
    @DisplayName("retry-after helpers reflect the configured windows")
    void retryAfter_reflectsConfiguredWindows() {
        AuthRateLimiterService service = newService();

        assertEquals(60, service.retryAfterSeconds());
        assertEquals(600, service.registerRetryAfterSeconds());
        assertEquals(60, service.refreshRetryAfterSeconds());
        assertEquals(900, service.passwordResetRetryAfterSeconds());
    }

    @Test
    @DisplayName("non-positive config values are clamped to safe minimums (max>=1, window>=1)")
    void config_clampedToSafeMinimums() {
        // max=0 / window=0 must not block everything nor divide-by-zero; clamp to 1.
        AuthRateLimiterService service = new AuthRateLimiterService(0, 0, 0, 0, 0, 0, 0, 0);

        assertTrue(service.allowRegister("4.4.4.4"), "first call allowed even with max=0 (clamped to 1)");
        assertFalse(service.allowRegister("4.4.4.4"), "second call blocked at clamped max=1");
        assertEquals(1, service.registerRetryAfterSeconds());
    }

    @Test
    @DisplayName("null/blank IP and email are handled without throwing")
    void nullInputs_handledGracefully() {
        AuthRateLimiterService service = newService();

        assertTrue(service.allow(null, null));
        assertTrue(service.allowRegister(null));
        assertTrue(service.allowRefresh(null));
    }
}
