package com.deutschflow.common.telemetry;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class ApiTelemetryService {

    private final JdbcTemplate jdbcTemplate;

    public void record(ApiTelemetryEvent event) {
        try {
            jdbcTemplate.update("""
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
                    """,
                    event.eventName(),
                    Timestamp.valueOf(event.eventTime()),
                    event.userId(),
                    event.sessionId(),
                    event.role(),
                    event.requestId(),
                    event.method(),
                    event.endpoint(),
                    event.statusCode(),
                    event.latencyMs(),
                    event.error()
            );
        } catch (DataAccessException ex) {
            log.warn("Skip telemetry persistence due to db issue: {}", ex.getMessage());
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
