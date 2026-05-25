package com.deutschflow.testsupport;

/**
 * JUnit conditional execution helper for PostgreSQL integration tests.
 */
public final class TestcontainersPostgresConditions {

    private TestcontainersPostgresConditions() {
    }

    public static boolean integrationPostgresAvailable() {
        return PostgresIntegrationDb.usesExternalJdbcUrl() || PostgresIntegrationDb.isDockerAvailable();
    }
}
