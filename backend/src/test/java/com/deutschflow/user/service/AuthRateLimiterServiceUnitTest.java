package com.deutschflow.user.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;

class AuthRateLimiterServiceUnitTest {

    private final AuthRateLimiterService service = new AuthRateLimiterService();

    @Test
    void instantiated() {
        assertNotNull(service);
    }
}
