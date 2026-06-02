package com.deutschflow.notification.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ExpoPushSenderServiceUnitTest {

    @Test
    @DisplayName("accepts Expo push tokens (ExponentPushToken[...] and ExpoPushToken[...])")
    void acceptsExpoTokens() {
        assertThat(ExpoPushSenderService.isExpoPushToken("ExponentPushToken[xxxxxxxxxxxxxxxxxxxx]")).isTrue();
        assertThat(ExpoPushSenderService.isExpoPushToken("ExpoPushToken[yyyyyyyyyyyy]")).isTrue();
        assertThat(ExpoPushSenderService.isExpoPushToken("  ExponentPushToken[trimmed]  ")).isTrue();
    }

    @Test
    @DisplayName("rejects raw APNs tokens, null, blank, and junk")
    void rejectsNonExpoTokens() {
        // 64-hex APNs device token — exactly what the legacy Capacitor build registered.
        assertThat(ExpoPushSenderService.isExpoPushToken(
                "740f4707bebcf74f9b7c25d48e3358945f6aa01da5ddb387462c7eaf61bb78ad")).isFalse();
        assertThat(ExpoPushSenderService.isExpoPushToken(null)).isFalse();
        assertThat(ExpoPushSenderService.isExpoPushToken("")).isFalse();
        assertThat(ExpoPushSenderService.isExpoPushToken("   ")).isFalse();
        assertThat(ExpoPushSenderService.isExpoPushToken("random-string")).isFalse();
    }
}
