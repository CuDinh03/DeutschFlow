package com.deutschflow.common.retention;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.LocalDateTime;

/**
 * Nightly purge of unbounded event tables so they don't grow forever (and slow every query +
 * eventually fill RDS storage — a contributing factor to the connection-pool incident).
 *
 * <p>Deletes in small batches via {@code ctid IN (SELECT ... LIMIT n)} so each statement is a short
 * transaction holding only brief locks, instead of one giant DELETE that locks the table and bloats
 * WAL. Retention windows and batch sizing are configurable; the whole job can be disabled.
 *
 * <p>NOTE: single-node safe (runs once). When the app scales to >1 node this needs a distributed
 * lock (ShedLock) so it doesn't run on every node — tracked in the cluster-hardening backlog.
 */
@Component
@Slf4j
public class DataRetentionJob {

    private final JdbcTemplate jdbcTemplate;
    private final boolean enabled;
    private final int telemetryDays;
    private final int xpDays;
    private final int tokenUsageDays;
    private final int batchSize;
    private final long maxRowsPerRun;

    public DataRetentionJob(
            JdbcTemplate jdbcTemplate,
            @Value("${app.retention.enabled:true}") boolean enabled,
            @Value("${app.retention.telemetry-days:30}") int telemetryDays,
            @Value("${app.retention.xp-days:180}") int xpDays,
            @Value("${app.retention.token-usage-days:90}") int tokenUsageDays,
            @Value("${app.retention.batch-size:5000}") int batchSize,
            @Value("${app.retention.max-rows-per-run:500000}") long maxRowsPerRun) {
        this.jdbcTemplate = jdbcTemplate;
        this.enabled = enabled;
        this.telemetryDays = telemetryDays;
        this.xpDays = xpDays;
        this.tokenUsageDays = tokenUsageDays;
        this.batchSize = Math.max(100, batchSize);
        this.maxRowsPerRun = Math.max(this.batchSize, maxRowsPerRun);
    }

    /** Runs nightly at 03:30 (after the 03:00 FSRS optimizer). */
    @Scheduled(cron = "${app.retention.cron:0 30 3 * * *}")
    @SchedulerLock(name = "dataRetentionPurge", lockAtMostFor = "PT1H", lockAtLeastFor = "PT1M")
    public void purgeOldEvents() {
        if (!enabled) {
            return;
        }
        purge("api_telemetry_events", "event_time", telemetryDays);
        purge("user_xp_events", "created_at", xpDays);
        purge("ai_token_usage_events", "created_at", tokenUsageDays);
    }

    /**
     * Batched delete of rows older than {@code retentionDays} in {@code table}. {@code table} and
     * {@code timeColumn} are hard-coded call-site literals (never user input) — safe to interpolate.
     */
    private void purge(String table, String timeColumn, int retentionDays) {
        Timestamp cutoff = Timestamp.valueOf(LocalDateTime.now().minusDays(retentionDays));
        String sql = "DELETE FROM " + table
                + " WHERE ctid IN (SELECT ctid FROM " + table
                + " WHERE " + timeColumn + " < ? LIMIT " + batchSize + ")";
        long total = 0;
        try {
            int deleted;
            do {
                deleted = jdbcTemplate.update(sql, cutoff);
                total += deleted;
            } while (deleted == batchSize && total < maxRowsPerRun);

            if (total > 0) {
                log.info("[retention] {} — deleted {} rows older than {}d (cutoff {})",
                        table, total, retentionDays, cutoff);
            }
            if (total >= maxRowsPerRun) {
                log.warn("[retention] {} — hit max-rows-per-run cap ({}); more old rows remain, "
                        + "will continue next run", table, maxRowsPerRun);
            }
        } catch (DataAccessException ex) {
            // Best-effort housekeeping — never let it bubble up and kill the scheduler thread.
            log.warn("[retention] {} — purge failed after {} rows: {}", table, total, ex.getMessage());
        }
    }
}
