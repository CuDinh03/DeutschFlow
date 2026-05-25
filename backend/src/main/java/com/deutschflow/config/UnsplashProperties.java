package com.deutschflow.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "unsplash")
public record UnsplashProperties(
        boolean enabled,
        String accessKey,
        String secretKey,
        String applicationName,
        int timeoutMs,
        int connectTimeoutMs,
        int maxRetryAttempts
) {
    public boolean isConfigured() {
        return enabled && accessKey != null && !accessKey.isBlank();
    }
}
