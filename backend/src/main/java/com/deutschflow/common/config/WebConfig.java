package com.deutschflow.common.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import org.springframework.context.annotation.Bean;
import org.springframework.web.client.RestTemplate;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${app.cors.allowed-origins:http://localhost:3000}")
    private String allowedOrigins;

    // Capacitor iOS/Android origins — always allowed regardless of env var
    private static final String[] NATIVE_ORIGINS = {
        "capacitor://localhost",
        "ionic://localhost",
        "http://localhost"
    };

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        String[] configuredOrigins = allowedOrigins.split(",");
        String[] allOrigins = java.util.stream.Stream
                .concat(java.util.Arrays.stream(configuredOrigins),
                        java.util.Arrays.stream(NATIVE_ORIGINS))
                .map(String::trim)
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
        return new RestTemplate();
    }
}
