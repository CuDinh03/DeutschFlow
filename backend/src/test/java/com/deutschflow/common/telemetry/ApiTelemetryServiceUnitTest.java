package com.deutschflow.common.telemetry;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class ApiTelemetryServiceUnitTest {

    @Mock
    JdbcTemplate jdbcTemplate;

    @InjectMocks
    ApiTelemetryService service;

    private static ApiTelemetryEvent event() {
        return new ApiTelemetryEvent(
                "api.request.completed",
                LocalDateTime.now(),
                1L,
                "sess",
                "STUDENT",
                "req-1",
                "GET",
                "/api/words",
                200,
                12L,
                false);
    }

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }

    @Test
    void record_doesNotTouchDbSynchronously() {
        // record() runs on the request hot path — it must only enqueue, never hit the DB.
        service.record(event());

        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void flush_batchInsertsBufferedEvents() {
        service.record(event());
        service.record(event());

        service.flush();

        // One batched INSERT for the whole buffer, not one INSERT per event.
        verify(jdbcTemplate, times(1)).batchUpdate(anyString(), anyList());
    }

    @Test
    void flush_isNoopWhenBufferEmpty() {
        service.flush();

        verify(jdbcTemplate, never()).batchUpdate(anyString(), anyList());
    }
}
