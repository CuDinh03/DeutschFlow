package com.deutschflow.user.onboarding;

import java.util.Locale;

/**
 * Access channel a learner onboards from. Drives the conversion strategy: iOS is a
 * "reader app" where Apple Guideline 3.1.1 forbids in-app pricing/checkout, so iOS
 * optimizes activation and defers conversion to email/web.
 */
public enum Platform {
    WEB,
    IOS,
    ANDROID;

    /** Lenient parse from a client-supplied platform string; defaults to {@link #WEB}. */
    public static Platform fromText(String raw) {
        if (raw == null || raw.isBlank()) {
            return WEB;
        }
        return switch (raw.trim().toUpperCase(Locale.ROOT)) {
            case "IOS", "IPHONE", "IPAD", "APPLE" -> IOS;
            case "ANDROID" -> ANDROID;
            default -> WEB;
        };
    }

    /** Whether the client may show in-app paywall/pricing. False on iOS (Apple 3.1.1). */
    public boolean allowsInAppPaywall() {
        return this != IOS;
    }
}
