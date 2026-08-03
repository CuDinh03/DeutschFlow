package com.deutschflow.testsupport;

import org.springframework.util.StringUtils;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.utility.DockerImageName;

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

    public static boolean isDockerAvailable() {
        if (usesExternalJdbcUrl()) {
            return true;
        }
        try {
            return DockerClientFactory.instance().isDockerAvailable();
        } catch (Throwable ex) {
            return false;
        }
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
            return new Config(withProductionDriverFlags(urlEnv.strip()), user, pass);
        }
        PostgreSQLContainer<?> pg = PostgresTestContainerHolder.get();
        return new Config(withProductionDriverFlags(pg.getJdbcUrl()), pg.getUsername(), pg.getPassword());
    }

    /**
     * Gắn {@code stringtype=unspecified} — đúng tham số mà URL production dùng
     * ({@code application.yml}, {@code spring.datasource.url}).
     *
     * <p><b>Vì sao bắt buộc:</b> tham số này quyết định pgjdbc gửi {@code setString} với OID
     * {@code varchar} hay {@code unknown}. Postgres KHÔNG tự ép {@code varchar → jsonb}, nên mọi
     * lệnh ghi một chuỗi JSON vào cột {@code jsonb} — {@code audit_logs.metadata_json} là chỗ
     * điển hình — chạy được trên prod nhưng nổ {@code PSQLException} trong IT nếu URL của test
     * thiếu nó. Datasource của IT lệch prod ở điểm đổi ngữ nghĩa SQL thì kết quả IT vô nghĩa theo
     * cả hai chiều: đỏ giả như trên, và nguy hiểm hơn là xanh giả cho SQL prod sẽ từ chối.
     *
     * <p>Tôn trọng lựa chọn của người chạy: URL đã tự khai {@code stringtype} thì giữ nguyên.
     */
    private static String withProductionDriverFlags(String jdbcUrl) {
        if (jdbcUrl.contains("stringtype=")) {
            return jdbcUrl;
        }
        return jdbcUrl + (jdbcUrl.contains("?") ? "&" : "?") + "stringtype=unspecified";
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
