package com.deutschflow.common.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Spring Boot 3.2.x does not honour {@code spring.flyway.repair-on-migrate} (that property
 * exists only in newer Boot versions). A custom {@link FlywayMigrationStrategy} runs
 * {@code repair()} before {@code migrate()} so local checksum drift (e.g. edited V48 after apply)
 * does not block startup. Disable in production via {@code APP_FLYWAY_REPAIR_BEFORE_MIGRATE=false}.
 */
@Configuration
public class FlywayRepairMigrationConfig {

    @Bean
    @ConditionalOnProperty(prefix = "app.flyway", name = "repair-before-migrate", havingValue = "true")
    public FlywayMigrationStrategy flywayRepairThenMigrate() {
        return flyway -> {
            flyway.repair();
            flyway.migrate();
        };
    }
}
