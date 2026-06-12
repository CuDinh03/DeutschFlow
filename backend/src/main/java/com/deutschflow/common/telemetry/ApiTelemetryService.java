package com.deutschflow.common.telemetry;

import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.atomic.AtomicLong;

@Service
@Slf4j
@RequiredArgsConstructor
public class ApiTelemetryService {

    private static final String INSERT_SQL = """
            INSERT INTO api_telemetry_events (
              event_name,
              event_time,
              user_id,
              session_id,
              role,
              request_id,
              method,
              endpoint,
              status_code,
              latency_ms,
              is_error
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """;

    /** Bound the buffer so a DB outage can't grow it without limit (back-pressure → drop). */
    private static final int QUEUE_CAPACITY = 10_000;
    /** Max rows per flush — keeps each INSERT batch (and the connection it holds) short. */
    private static final int FLUSH_BATCH_SIZE = 500;

    private final JdbcTemplate jdbcTemplate;

    private final BlockingQueue<ApiTelemetryEvent> queue = new ArrayBlockingQueue<>(QUEUE_CAPACITY);
    private final AtomicLong droppedCount = new AtomicLong(0);

    /**
     * Hot path: called from {@link ApiTelemetryFilter} on EVERY request. Must NOT touch the DB
     * here — a synchronous INSERT-per-request holds a Hikari connection for the request's lifetime
     * and was a prime contributor to pool exhaustion. We only enqueue (non-blocking); a scheduled
     * flush batches the writes. If the buffer is full (DB slow/down) we drop and count — telemetry
     * is best-effort and must never slow or fail a user request.
     */
    public void record(ApiTelemetryEvent event) {
        if (!queue.offer(event)) {
            long dropped = droppedCount.incrementAndGet();
            // Log sparsely so a sustained outage doesn't flood logs.
            if (dropped % 1000 == 1) {
                log.warn("Telemetry buffer full — dropped {} events so far (DB slow or down?)", dropped);
            }
        }
    }

    /** Drains the buffer and batch-inserts. Runs on the scheduler thread, off the request path. */
    @Scheduled(fixedDelayString = "${app.telemetry.flush-interval-ms:5000}")
    public void flush() {
        if (queue.isEmpty()) {
            return;
        }
        List<ApiTelemetryEvent> batch = new ArrayList<>(FLUSH_BATCH_SIZE);
        queue.drainTo(batch, FLUSH_BATCH_SIZE);
        if (batch.isEmpty()) {
            return;
        }
        try {
            List<Object[]> args = new ArrayList<>(batch.size());
            for (ApiTelemetryEvent e : batch) {
                args.add(new Object[]{
                        e.eventName(),
                        Timestamp.valueOf(e.eventTime()),
                        e.userId(),
                        e.sessionId(),
                        e.role(),
                        e.requestId(),
                        e.method(),
                        e.endpoint(),
                        e.statusCode(),
                        e.latencyMs(),
                        e.error()
                });
            }
            jdbcTemplate.batchUpdate(INSERT_SQL, args);
        } catch (DataAccessException ex) {
            // Drop this batch rather than requeue (avoids unbounded retry loops when DB is down).
            log.warn("Skip telemetry batch ({} rows) due to db issue: {}", batch.size(), ex.getMessage());
        }
    }

    /** Best-effort flush of whatever is buffered when the app shuts down (deploy/restart). */
    @PreDestroy
    public void flushOnShutdown() {
        for (int i = 0; i < (QUEUE_CAPACITY / FLUSH_BATCH_SIZE) + 1 && !queue.isEmpty(); i++) {
            flush();
        }
    }

    public List<Map<String, Object>> latencyErrorSummary(int days) {
        int safeDays = Math.max(1, Math.min(days, 90));
        LocalDateTime from = LocalDateTime.now().minusDays(safeDays - 1L);
        return jdbcTemplate.query("""
                SELECT
                  DATE(event_time) AS snapshotDate,
                  COUNT(*) AS totalRequests,
                  SUM(CASE WHEN is_error THEN 1 ELSE 0 END) AS errorRequests,
                  ROUND(AVG(latency_ms), 2) AS avgLatencyMs,
                  ROUND(100.0 * SUM(CASE WHEN is_error THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS errorRatePercent
                FROM api_telemetry_events
                WHERE event_time >= ?
                GROUP BY DATE(event_time)
                ORDER BY snapshotDate ASC
                """, (rs, rowNum) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("snapshotDate", rs.getDate("snapshotDate").toLocalDate());
            item.put("totalRequests", rs.getLong("totalRequests"));
            item.put("errorRequests", rs.getLong("errorRequests"));
            item.put("avgLatencyMs", rs.getDouble("avgLatencyMs"));
            item.put("errorRatePercent", rs.getDouble("errorRatePercent"));
            return item;
        }, Timestamp.valueOf(from));
    }

    public Map<String, Object> latencyPercentiles(int days, String endpoint) {
        int safeDays = Math.max(1, Math.min(days, 90));
        String safeEndpoint = (endpoint == null || endpoint.isBlank()) ? "/api/plan/sessions/submit" : endpoint.trim();
        LocalDateTime from = LocalDateTime.now().minusDays(safeDays - 1L);

        List<Long> samples = jdbcTemplate.query("""
                SELECT latency_ms
                FROM api_telemetry_events
                WHERE event_time >= ? AND endpoint = ?
                ORDER BY latency_ms ASC
                """, (rs, rowNum) -> rs.getLong("latency_ms"), Timestamp.valueOf(from), safeEndpoint);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("days", safeDays);
        out.put("endpoint", safeEndpoint);
        out.put("sampleCount", samples.size());
        out.put("p50LatencyMs", percentile(samples, 0.50));
        out.put("p95LatencyMs", percentile(samples, 0.95));
        out.put("p99LatencyMs", percentile(samples, 0.99));
        return out;
    }

    private static double percentile(List<Long> sortedSamples, double ratio) {
        if (sortedSamples == null || sortedSamples.isEmpty()) {
            return 0.0;
        }
        int index = (int) Math.ceil(ratio * sortedSamples.size()) - 1;
        index = Math.max(0, Math.min(index, sortedSamples.size() - 1));
        return sortedSamples.get(index);
    }
}
