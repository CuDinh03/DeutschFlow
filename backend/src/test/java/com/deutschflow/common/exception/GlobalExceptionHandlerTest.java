package com.deutschflow.common.exception;

import com.deutschflow.common.exception.GlobalExceptionHandler.ProblemDetail;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpHeaders;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link GlobalExceptionHandler} no-handler mapping.
 *
 * <p>Regression guard: a request to an unmapped path (e.g. an endpoint that exists in a newer
 * build but is not yet deployed) must return an honest 404 — NOT bubble to the catch-all 500
 * handler and surface as a scary "An unexpected error occurred. Reference: ERR-x".
 */
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    private HttpServletRequest requestTo(String uri) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn(uri);
        when(request.getMethod()).thenReturn("GET");
        return request;
    }

    @Test
    @DisplayName("NoResourceFoundException maps to 404 with endpoint-not-found problem detail")
    void noResource_mapsTo404() {
        var ex = new NoResourceFoundException(HttpMethod.GET, "/api/v2/students/classes");

        ResponseEntity<ProblemDetail> response =
                handler.handleNoHandler(ex, requestTo("/api/v2/students/classes"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        ProblemDetail body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body.status()).isEqualTo(404);
        assertThat(body.title()).isEqualTo("Endpoint Not Found");
        assertThat(body.type()).endsWith("endpoint-not-found");
        assertThat(body.instance()).isEqualTo("/api/v2/students/classes");
        // Must NOT leak an internal "ERR-x" reference (that is the 500 catch-all's signature).
        assertThat(body.detail()).doesNotContain("ERR-");
    }

    @Test
    @DisplayName("NoHandlerFoundException maps to 404 as well")
    void noHandler_mapsTo404() {
        var ex = new NoHandlerFoundException("GET", "/api/does-not-exist", new HttpHeaders());

        ResponseEntity<ProblemDetail> response =
                handler.handleNoHandler(ex, requestTo("/api/does-not-exist"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo(404);
    }

    @Test
    @DisplayName("DataIntegrityViolationException maps to 409 without leaking DB constraint names")
    void dataIntegrity_mapsTo409_noLeak() {
        var ex = new org.springframework.dao.DataIntegrityViolationException(
                "insert or update on \"organizations\" violates foreign key constraint \"organizations_plan_code_fkey\"");

        ResponseEntity<ProblemDetail> response =
                handler.handleDataIntegrity(ex, requestTo("/api/admin/organizations"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        ProblemDetail body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body.status()).isEqualTo(409);
        assertThat(body.type()).endsWith("data-integrity");
        // Client message must stay generic — no table/column/constraint names from the driver.
        assertThat(body.detail()).doesNotContain("organizations_plan_code_fkey");
        assertThat(body.detail()).doesNotContain("foreign key");
    }

    /**
     * RCA + fix for "An unexpected error occurred. Reference: ERR-161" (and ERR-74C).
     *
     * <p>The login incident: when the Hikari pool is exhausted (or Postgres is unreachable), the
     * connection cannot be obtained within {@code connection-timeout} (5s) and Spring throws
     * {@link org.springframework.jdbc.CannotGetJdbcConnectionException} (a
     * {@code DataAccessResourceFailureException}). That is not a {@code BadCredentialsException}, so
     * {@code AuthService.login} does not catch it; it bubbles to the advice. PRE-FIX it hit the
     * catch-all {@code handleGeneral} and surfaced as the scary 500 "ERR-x". It NOW maps to an honest,
     * RETRYABLE 503. (Redis failures are caught and degraded in {@code AuthRateLimiterService}, see
     * {@code AuthRateLimiterServiceUnitTest} — so ERR-161 was a DB-connection failure, NOT Redis.)
     */
    @Test
    @DisplayName("DB connection-pool failure → 503 retryable (was the masked 500 / ERR-161), no leak")
    void dbConnectionFailure_mapsTo503Retryable() {
        var ex = new org.springframework.jdbc.CannotGetJdbcConnectionException(
                "Failed to obtain JDBC Connection",
                new java.sql.SQLTransientConnectionException(
                        "HikariPool-1 - Connection is not available, request timed out after 5000ms"));

        ResponseEntity<ProblemDetail> response = handler.handleDbUnavailable(ex, requestTo("/api/auth/login"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getHeaders().getFirst("Retry-After")).isEqualTo("3");
        ProblemDetail body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body.status()).isEqualTo(503);
        assertThat(body.type()).endsWith("db-unavailable");
        assertThat(body.extensions()).containsEntry("retryAfterSeconds", 3);
        // Carries a support reference, but no internal infra detail leaks to the client.
        assertThat(body.detail()).contains("ERR-");
        assertThat(body.detail()).doesNotContain("HikariPool").doesNotContain("JDBC").doesNotContain("5000ms");
    }

    /**
     * The {@code @Transactional} variant: a login/transactional method fails at tx-begin because it
     * cannot open a connection → {@link org.springframework.transaction.CannotCreateTransactionException}
     * (wrapping the JDBC cause). Must also map to a retryable 503, not a 500.
     */
    @Test
    @DisplayName("@Transactional begin failure (CannotCreateTransactionException) → 503 retryable")
    void cannotCreateTransaction_mapsTo503() {
        var ex = new org.springframework.transaction.CannotCreateTransactionException(
                "Could not open JDBC Connection for transaction",
                new org.springframework.jdbc.CannotGetJdbcConnectionException("pool timeout after 5000ms"));

        ResponseEntity<ProblemDetail> response = handler.handleDbUnavailable(ex, requestTo("/api/auth/login"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        ProblemDetail body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body.status()).isEqualTo(503);
        assertThat(body.detail()).doesNotContain("5000ms"); // no leak of the wrapped cause's message
    }
}
