package com.deutschflow.common.config;

import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.provider.jdbctemplate.JdbcTemplateLockProvider;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;

/**
 * S-7: distributed scheduler lock. Every {@code @Scheduled} job annotated with {@code @SchedulerLock}
 * runs on exactly one node at a time (a row in the {@code shedlock} table, see V239) — this prevents
 * double-send / double-charge / double-cleanup when more than one app instance runs (multi-node, or
 * the blue-green deploy window where two colors overlap).
 *
 * <p>Jobs intentionally NOT locked because they are already multi-node safe / per-node by design:
 * <ul>
 *   <li>{@code AiJobWorker} — claims work with {@code SELECT ... FOR UPDATE SKIP LOCKED}.</li>
 *   <li>{@code ApiTelemetryService.flush} — flushes a per-node in-memory buffer (each node must flush its own).</li>
 *   <li>{@code EnrichmentSuspendGate.evaluate} — sets a per-node in-memory latch (each node decides for itself).</li>
 * </ul>
 *
 * <p>Uses DB time ({@code usingDbTime()}) so node clock skew can't cause a lock to expire early.
 */
@Configuration
@EnableSchedulerLock(defaultLockAtMostFor = "PT15M")
public class ShedLockConfig {

    @Bean
    public LockProvider lockProvider(DataSource dataSource) {
        return new JdbcTemplateLockProvider(
                JdbcTemplateLockProvider.Configuration.builder()
                        .withJdbcTemplate(new JdbcTemplate(dataSource))
                        .usingDbTime()
                        .build());
    }
}
