package com.deutschflow.common.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import org.springframework.context.annotation.Bean;
import org.springframework.web.client.RestTemplate;

import com.deutschflow.common.http.RestTemplates;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${app.cors.allowed-origins:http://localhost:3000}")
    private String allowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        // SEC-4: CORS origins are env-driven only (CORS_ALLOWED_ORIGINS → prod domains; dev default
        // http://localhost:3000). The old hardcoded NATIVE_ORIGINS (capacitor://, ionic://, http://localhost)
        // were a retired Capacitor-webview leftover; with allowCredentials(true), a bare http://localhost
        // made any local http app a trusted credentialed origin. The current mobile app is Expo/native
        // (React Native HTTP, not a webview), so it does not rely on CORS.
        String[] allOrigins = java.util.Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .toArray(String[]::new);

        registry.addMapping("/api/**")
                .allowedOrigins(allOrigins)
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .exposedHeaders("X-Request-Id", "X-Platform")
                .allowCredentials(true)
                .maxAge(3600);
    }

    @Override
    public void addInterceptors(org.springframework.web.servlet.config.annotation.InterceptorRegistry registry) {
        registry.addInterceptor(new com.deutschflow.common.versioning.ApiDeprecationInterceptor());
    }

    @Bean
    public RestTemplate restTemplate() {
        // 3s connect, 10s read — never let a hung upstream pin a request/DB-connection forever.
        return RestTemplates.withTimeouts(3000, 10000);
    }
}
