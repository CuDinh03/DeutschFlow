package com.deutschflow.common.telemetry;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class ApiTelemetryServiceUnitTest {
    @Mock org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @InjectMocks
    ApiTelemetryService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }
}
