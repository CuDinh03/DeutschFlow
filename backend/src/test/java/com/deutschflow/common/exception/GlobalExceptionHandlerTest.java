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
}
