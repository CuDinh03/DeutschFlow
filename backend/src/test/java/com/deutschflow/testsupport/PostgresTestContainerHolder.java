package com.deutschflow.testsupport;

import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Singleton Postgres container for integration tests that start Spring Boot and for lightweight JDBC tests.
 * <p>
 * Lazy start avoids static init failures before error reporting and matches Testcontainers best practice
 * for JVMs that load this class during Spring condition evaluation.
 */
public final class PostgresTestContainerHolder {

    private static final DockerImageName PG_IMAGE = DockerImageName.parse("postgres:16-alpine");

    private static volatile PostgreSQLContainer<?> instance;

    private PostgresTestContainerHolder() {
    }

    public static PostgreSQLContainer<?> get() {
        if (PostgresIntegrationDb.usesExternalJdbcUrl()) {
            throw new IllegalStateException(
                    "DEUTSCHFLOW_IT_JDBC_URL is set: integration tests use a real Postgres URI. "
                            + "Call PostgresIntegrationDb.resolve() for JDBC URLs; do not use PostgresTestContainerHolder.");
        }
        PostgreSQLContainer<?> local = instance;
        if (local == null) {
            synchronized (PostgresTestContainerHolder.class) {
                local = instance;
                if (local == null) {
                    try {
                        PostgreSQLContainer<?> c = new PostgreSQLContainer<>(PG_IMAGE);
                        c.start();
                        instance = c;
                        local = c;
                    } catch (IllegalStateException e) {
                        throw macDockerHint(e);
                    } catch (RuntimeException e) {
                        Throwable cause = e.getCause();
                        if (cause instanceof IllegalStateException ise) {
                            throw macDockerHint(ise);
                        }
                        throw e;
                    }
                }
            }
        }
        return local;
    }

    private static IllegalStateException macDockerHint(IllegalStateException e) {
        String msg = e.getMessage() == null ? "" : e.getMessage();
        if (!msg.contains("Docker") && !msg.contains("docker")) {
            return e;
        }
        String home = System.getProperty("user.home", "");
        String hint =
                e.getMessage()
                        + System.lineSeparator()
                        + System.lineSeparator()
                        + "DeutschFlow (macOS): ensure Docker is running, then try one of:"
                        + System.lineSeparator()
                        + "  export DOCKER_HOST=unix://" + home + "/.docker/run/docker.sock   # Docker Desktop (user socket)"
                        + System.lineSeparator()
                        + "  export DOCKER_HOST=unix://" + home + "/.colima/default/docker.sock   # Colima default"
                        + System.lineSeparator()
                        + "See backend/src/test/resources/.testcontainers.properties and README (Testcontainers).";
        IllegalStateException wrapped = new IllegalStateException(hint, e);
        wrapped.setStackTrace(e.getStackTrace());
        return wrapped;
    }
}
