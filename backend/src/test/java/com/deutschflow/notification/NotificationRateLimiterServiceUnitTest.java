package com.deutschflow.notification;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;

class NotificationRateLimiterServiceUnitTest {

    private final NotificationRateLimiterService service = new NotificationRateLimiterService();

    @Test
    void instantiated() {
        assertNotNull(service);
    }
}
