package com.deutschflow.testsupport;

import org.springframework.util.StringUtils;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Resolves JDBC settings for backend integration tests: either a developer-provided Postgres URL
 * (works when Docker is unavailable inside the JVM, e.g. some IDE sandboxes on macOS) or a Testcontainers Postgres
 * singleton via {@link PostgresTestContainerHolder}.
 */
public final class PostgresIntegrationDb {

    /** Non-blank = skip Testcontainers and use this JDBC URL instead. Prefer a disposable database. */
    public static final String ENV_JDBC_URL = "DEUTSCHFLOW_IT_JDBC_URL";

    public static final String ENV_USERNAME = "DEUTSCHFLOW_IT_DB_USERNAME";
    public static final String ENV_PASSWORD = "DEUTSCHFLOW_IT_DB_PASSWORD";

    private PostgresIntegrationDb() {
    }

    public static boolean usesExternalJdbcUrl() {
        return StringUtils.hasText(System.getenv(ENV_JDBC_URL));
    }

    /**
     * Coordinates used by Flyway-backed Spring Boot tests ({@link AbstractPostgresIntegrationTest}).
     * Use a dedicated local database (for example {@code deutschflow_test}) — migrations apply on startup.
     */
    public static Config resolve() {
        String urlEnv = System.getenv(ENV_JDBC_URL);
        if (StringUtils.hasText(urlEnv)) {
            String user = fb(System.getenv(ENV_USERNAME), "postgres");
            String pass = fb(System.getenv(ENV_PASSWORD), "postgres");
            return new Config(urlEnv.strip(), user, pass);
        }
        PostgreSQLContainer<?> pg = PostgresTestContainerHolder.get();
        return new Config(pg.getJdbcUrl(), pg.getUsername(), pg.getPassword());
    }

    public static String withCurrentSchema(String jdbcUrl, String schema) {
        if (!StringUtils.hasText(schema)) {
            return jdbcUrl;
        }
        String q = "currentSchema=" + schema;
        return jdbcUrl.contains("?") ? jdbcUrl + "&" + q : jdbcUrl + "?" + q;
    }

    private static String fb(String v, String d) {
        return StringUtils.hasText(v) ? v.strip() : d;
    }

    public record Config(String jdbcUrl, String username, String password) {
    }
}
