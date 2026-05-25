package com.deutschflow.common.audit;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class AuditLogServiceUnitTest {
    @Mock org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    @Mock com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    @InjectMocks
    AuditLogService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }
}
