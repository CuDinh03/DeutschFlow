package com.deutschflow.testsupport;

import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Shared PostgreSQL (Testcontainers) for Spring Boot integration tests. Flyway runs on startup
 * using real migrations; do not use H2 or hand-written schema SQL on this branch.
 */
@ActiveProfiles("test")
public abstract class AbstractPostgresIntegrationTest {

    @DynamicPropertySource
    static void registerDatasource(DynamicPropertyRegistry registry) {
        PostgresIntegrationDb.Config db = PostgresIntegrationDb.resolve();
        registry.add("spring.datasource.url", db::jdbcUrl);
        registry.add("spring.datasource.username", db::username);
        registry.add("spring.datasource.password", db::password);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    }
}
