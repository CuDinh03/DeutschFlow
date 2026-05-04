package com.deutschflow.testsupport;

import org.testcontainers.DockerClientFactory;

/**
 * Guards Flyway/Testcontainers-backed tests when Docker is unavailable (sandbox/IDE) or callers set
 * {@link PostgresIntegrationDb#ENV_JDBC_URL} for an external Postgres.
 */
public final class TestcontainersPostgresConditions {

    public static final String SKIP_ENV = "DEUTSCHFLOW_SKIP_TESTCONTAINERS";

    private TestcontainersPostgresConditions() {
    }

    /**
     * Runs IT when external JDBC URL is set, Docker is reachable for Testcontainers, and skip-env is unset.
     */
    public static boolean integrationPostgresAvailable() {
        if ("true".equalsIgnoreCase(System.getenv(SKIP_ENV))) {
            return false;
        }
        if (PostgresIntegrationDb.usesExternalJdbcUrl()) {
            return true;
        }
        try {
            return DockerClientFactory.instance().isDockerAvailable();
        } catch (Throwable t) {
            return false;
        }
    }
}
