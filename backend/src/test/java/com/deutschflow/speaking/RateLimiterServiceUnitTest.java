package com.deutschflow.speaking;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;

class RateLimiterServiceUnitTest {

    private final RateLimiterService service = new RateLimiterService();

    @Test
    void instantiated() {
        assertNotNull(service);
    }
}
