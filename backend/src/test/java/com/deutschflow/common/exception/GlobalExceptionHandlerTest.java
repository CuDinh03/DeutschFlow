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

    /**
     * Audit speaking 24/07 (BE-3): 503 AI phải mang {@code extensions.code} máy-đọc-được để client
     * phân loại, và header {@code Retry-After} khi nơi ném biết thời điểm nên thử lại (AI_BUSY từ
     * semaphore/breaker). Đêm 23/07 client chỉ nhận được 503 trần nên mọi lỗi hiển thị như nhau.
     */
    @Test
    @DisplayName("AiServiceException AI_BUSY → 503 + extensions.code + Retry-After header")
    void aiBusy_mapsTo503_withCodeAndRetryAfter() {
        var ex = new com.deutschflow.speaking.exception.AiServiceException(
                com.deutschflow.speaking.exception.AiErrorCode.AI_BUSY,
                "Trợ lý AI đang bận, vui lòng thử lại sau ít giây.", 15);

        ResponseEntity<ProblemDetail> response =
                handler.handleAiServiceUnavailable(ex, requestTo("/api/ai-speaking/sessions"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getHeaders().getFirst("Retry-After")).isEqualTo("15");
        ProblemDetail body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body.type()).endsWith("ai-unavailable");
        assertThat(body.extensions()).containsEntry("code", "AI_BUSY")
                .containsEntry("retryAfterSeconds", 15);
        assertThat(body.detail()).isEqualTo("Trợ lý AI đang bận, vui lòng thử lại sau ít giây.");
    }

    /** Constructor cũ (message-only) phải giữ tương thích: code mặc định, không Retry-After. */
    @Test
    @DisplayName("AiServiceException legacy → 503 với code mặc định AI_UPSTREAM_UNAVAILABLE, không Retry-After")
    void aiLegacy_mapsTo503_defaultCode_noRetryAfter() {
        var ex = new com.deutschflow.speaking.exception.AiServiceException(
                "Dịch vụ AI tạm thời không khả dụng, vui lòng thử lại sau.");

        ResponseEntity<ProblemDetail> response =
                handler.handleAiServiceUnavailable(ex, requestTo("/api/ai-speaking/sessions/1/chat"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getHeaders().getFirst("Retry-After")).isNull();
        ProblemDetail body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body.extensions()).containsEntry("code", "AI_UPSTREAM_UNAVAILABLE");
        assertThat(body.extensions()).doesNotContainKey("retryAfterSeconds");
        // Câu chữ lộ ra client phải trung tính: không tên vendor, không tiếng Anh kỹ thuật.
        assertThat(body.detail()).doesNotContain("Groq").doesNotContain("unavailable.");
    }

    /**
     * R-B8: đã GỠ handler riêng cho IllegalStateException (trước map MỌI ISE → 503 "AI Service
     * Unavailable" quá rộng). ISE nghiệp vụ nay rơi về 500 internal-error chung, KHÔNG đội lốt lỗi AI
     * và KHÔNG lộ message nghiệp vụ gốc.
     */
    @Test
    @DisplayName("R-B8: IllegalStateException nghiệp vụ → 500 internal-error, không đội lốt 503 AI")
    void illegalStateBusiness_mapsTo500_notAiUnavailable() {
        var ex = new IllegalStateException("Chỉ có thể đánh giá phiên học đã hoàn thành");

        ResponseEntity<ProblemDetail> response =
                handler.handleGeneral(ex, requestTo("/api/teacher/sessions/1/evaluate"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        ProblemDetail body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body.status()).isEqualTo(500);
        assertThat(body.type()).endsWith("internal-error");
        assertThat(body.extensions()).containsEntry("code", "INTERNAL");
        // KHÔNG còn nhãn "AI ... chưa cấu hình", KHÔNG lộ message nghiệp vụ gốc.
        assertThat(body.title()).doesNotContain("AI");
        assertThat(body.detail()).doesNotContain("phiên học");
    }
}
