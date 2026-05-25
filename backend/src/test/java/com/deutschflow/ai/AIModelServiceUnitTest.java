package com.deutschflow.ai;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * {@link AIModelService} tự tạo {@link org.springframework.web.client.RestTemplate} trong constructor —
 * không phù hợp {@code @InjectMocks} với field {@code String}.
 */
class AIModelServiceUnitTest {

    @Test
    void constructsWithAiServerUrl() {
        assertNotNull(new AIModelService("http://localhost:8000"));
    }
}
