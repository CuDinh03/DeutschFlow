package com.deutschflow.user.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class StudentTrialSubscriptionProvisionerUnitTest {

    @Mock
    JdbcTemplate jdbcTemplate;

    @InjectMocks
    StudentTrialSubscriptionProvisioner provisioner;

    @Test
    void provisionSevenDayTrial_insertsSubscriptionRow() {
        Instant start = Instant.parse("2026-05-01T00:00:00Z");
        Instant end = Instant.parse("2026-05-08T00:00:00Z");
        provisioner.provisionSevenDayTrial(55L, start, end);
        // Idempotent Postgres form: INSERT ... SELECT ... WHERE NOT EXISTS, with userId bound
        // twice (once for the row, once for the NOT EXISTS active-subscription guard).
        verify(jdbcTemplate).update(contains("WHERE NOT EXISTS"),
                eq(55L), eq("PRO"), any(), any(), eq(55L));
    }
}
