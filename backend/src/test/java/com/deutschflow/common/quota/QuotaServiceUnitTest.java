package com.deutschflow.common.quota;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class QuotaServiceUnitTest {

    @Mock
    JdbcTemplate jdbcTemplate;

    @InjectMocks
    QuotaService quotaService;

    @Test
    void applyUsageDebit_zeroTokens_doesNothing() {
        quotaService.applyUsageDebit(123L, 0, Instant.now());
        verify(jdbcTemplate, never()).update(anyString(), any(), any());
    }

    @Test
    void applyUsageDebit_negativeTokens_doesNothing() {
        quotaService.applyUsageDebit(123L, -5L, Instant.now());
        verify(jdbcTemplate, never()).update(anyString(), any(), any());
    }
}
