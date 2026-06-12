package com.deutschflow.ai;

import com.deutschflow.common.resilience.CircuitBreakers;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * {@link AIModelService} tự tạo {@link org.springframework.web.client.RestTemplate} trong constructor —
 * không phù hợp {@code @InjectMocks} với field {@code String}.
 */
class AIModelServiceUnitTest {

    @Test
    void constructsWithAiServerUrl() {
        var circuitBreakers = new CircuitBreakers(CircuitBreakerRegistry.ofDefaults());
        assertNotNull(new AIModelService("http://localhost:8000", 15000, circuitBreakers));
    }
}
