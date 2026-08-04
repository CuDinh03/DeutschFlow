package com.deutschflow.testsupport;

/**
 * JUnit conditional execution helper for PostgreSQL integration tests.
 */
public final class TestcontainersPostgresConditions {

    private TestcontainersPostgresConditions() {
    }

    /**
     * Đi qua cùng cổng với {@link AbstractPostgresIntegrationTest}: ở CI
     * ({@code DEUTSCHFLOW_IT_REQUIRE_DB=true}) thiếu database sẽ ném lỗi thay vì lặng lẽ
     * {@code @EnabledIf} thành disabled.
     */
    public static boolean integrationPostgresAvailable() {
        return PostgresIntegrationDb.availableOrFailWhenMandatory();
    }
}
