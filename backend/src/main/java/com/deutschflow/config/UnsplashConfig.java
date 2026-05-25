package com.deutschflow.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Slf4j
@Configuration
@EnableConfigurationProperties(UnsplashProperties.class)
@ConditionalOnProperty(prefix = "unsplash", name = "enabled", havingValue = "true")
public class UnsplashConfig {

    @Bean
    public RestClient unsplashRestClient(UnsplashProperties props) {
        if (!props.isConfigured()) {
            throw new IllegalStateException("unsplash.enabled and unsplash.access-key are required when Unsplash integration is enabled");
        }
        log.info("Unsplash integration enabled: appName={}, timeoutMs={}, connectTimeoutMs={}, maxRetryAttempts={}",
                props.applicationName(), props.timeoutMs(), props.connectTimeoutMs(), props.maxRetryAttempts());
        return RestClient.builder()
                .baseUrl("https://api.unsplash.com")
                .requestFactory(unsplashRequestFactory(props))
                .defaultHeader("Authorization", "Client-ID " + props.accessKey().trim())
                .defaultHeader("Accept-Version", "v1")
                .build();
    }

    @Bean
    public ObjectMapper unsplashObjectMapper() {
        return new ObjectMapper();
    }

    private ClientHttpRequestFactory unsplashRequestFactory(UnsplashProperties props) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(Math.max(1000, props.connectTimeoutMs())));
        factory.setReadTimeout(Duration.ofMillis(Math.max(1000, props.timeoutMs())));
        return factory;
    }
}
