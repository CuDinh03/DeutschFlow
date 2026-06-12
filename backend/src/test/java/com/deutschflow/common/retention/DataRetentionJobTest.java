package com.deutschflow.common.retention;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DataRetentionJobTest {

    @Mock
    JdbcTemplate jdbcTemplate;

    private DataRetentionJob job(boolean enabled) {
        return new DataRetentionJob(jdbcTemplate, enabled, 30, 180, 90, 5000, 500_000);
    }

    @Test
    void disabled_doesNothing() {
        job(false).purgeOldEvents();

        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void enabled_purgesAllThreeEventTables() {
        // Returning fewer rows than the batch size ends each table's delete loop after one pass.
        when(jdbcTemplate.update(anyString(), any(Object.class))).thenReturn(0);

        job(true).purgeOldEvents();

        // One DELETE per table: telemetry, xp, token-usage.
        verify(jdbcTemplate, times(3)).update(anyString(), any(Object.class));
    }
}
