package com.deutschflow.common.exception;

import com.deutschflow.common.quota.QuotaExceededException;
import com.deutschflow.common.exception.RateLimitExceededException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

/**
 * Global exception handler — RFC 7807 Problem Details (application/problem+json)
 *
 * Success responses: trả về data trực tiếp với HTTP 200/201/204.
 * Error responses: trả về ProblemDetail với Content-Type: application/problem+json.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final String BASE_TYPE = "https://deutschflow.com/errors/";
    private static final MediaType PROBLEM_JSON = MediaType.valueOf("application/problem+json");
    /** Monotonic counter to correlate a client-facing error reference with the server log. */
    private static final AtomicLong ERROR_SEQ = new AtomicLong();

    // --- 400 Bad Request ---
    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<ProblemDetail> handleBadRequest(BadRequestException ex,
                                                          HttpServletRequest request) {
        return problem(HttpStatus.BAD_REQUEST, "bad-request", "Bad Request",
                ex.getMessage(), request.getRequestURI(), null, null);
    }

    // --- 405 Method Not Allowed ---
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ProblemDetail> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex,
                                                                   HttpServletRequest request) {
        return problem(HttpStatus.METHOD_NOT_ALLOWED, "method-not-allowed", "Method Not Allowed",
                "HTTP method '" + ex.getMethod() + "' is not supported for this endpoint.",
                request.getRequestURI(), null, null);
    }

    // --- 400 Missing required request parameter ---
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ProblemDetail> handleMissingParam(MissingServletRequestParameterException ex,
                                                             HttpServletRequest request) {
        return problem(HttpStatus.BAD_REQUEST, "bad-request", "Bad Request",
                "Required parameter '" + ex.getParameterName() + "' is missing.",
                request.getRequestURI(), null, null);
    }

    // --- 400 Validation (JSR-303) ---
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ProblemDetail> handleValidation(MethodArgumentNotValidException ex,
                                                          HttpServletRequest request) {
        Map<String, String> errors = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        FieldError::getField,
                        f -> f.getDefaultMessage() != null ? f.getDefaultMessage() : "Invalid value",
                        (a, b) -> a   // giữ lỗi đầu tiên nếu trùng field
                ));

        return problem(HttpStatus.BAD_REQUEST, "validation-error", "Validation Failed",
                "One or more fields are invalid.", request.getRequestURI(), errors, null);
    }

    // --- 400 Validation (method-level: @Validated + element constraints on @RequestBody List<@Valid X>) ---
    // Without this, a constraint violation on a batch element falls through to the generic 500 handler.
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ProblemDetail> handleConstraintViolation(ConstraintViolationException ex,
                                                                   HttpServletRequest request) {
        Map<String, String> errors = ex.getConstraintViolations().stream()
                .collect(Collectors.toMap(
                        v -> v.getPropertyPath().toString(),
                        v -> v.getMessage() != null ? v.getMessage() : "Invalid value",
                        (a, b) -> a
                ));

        return problem(HttpStatus.BAD_REQUEST, "validation-error", "Validation Failed",
                "One or more fields are invalid.", request.getRequestURI(), errors, null);
    }

    // --- 403 Forbidden ---
    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<ProblemDetail> handleForbidden(ForbiddenException ex,
                                                         HttpServletRequest request) {
        return problem(HttpStatus.FORBIDDEN, "forbidden", "Forbidden",
                ex.getMessage(), request.getRequestURI(), null, null);
    }

    // --- 404 Not Found ---
    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ProblemDetail> handleNotFound(NotFoundException ex,
                                                        HttpServletRequest request) {
        return problem(HttpStatus.NOT_FOUND, "not-found", "Not Found",
                ex.getMessage(), request.getRequestURI(), null, null);
    }

    // --- 409 Conflict ---
    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ProblemDetail> handleConflict(ConflictException ex,
                                                        HttpServletRequest request) {
        return problem(HttpStatus.CONFLICT, "conflict", "Conflict",
                ex.getMessage(), request.getRequestURI(), null, null);
    }

    // --- 429 Quota exceeded ---
    @ExceptionHandler(QuotaExceededException.class)
    public ResponseEntity<ProblemDetail> handleQuotaExceeded(QuotaExceededException ex,
                                                             HttpServletRequest request) {
        Map<String, Object> ext = null;
        if (ex.getSnapshot() != null) {
            var s = ex.getSnapshot();
            ext = new java.util.LinkedHashMap<>();
            ext.put("planCode", s.planCode());
            ext.put("unlimitedInternal", s.unlimitedInternal());
            ext.put("dailyTokenGrant", s.dailyTokenGrant());
            ext.put("walletBalance", s.walletBalance());
            ext.put("walletCap", s.walletCap());
            ext.put("usedToday", s.usedToday());
            ext.put("monthlyTokenLimit", s.monthlyTokenLimit());
            ext.put("usedThisMonth", s.usedThisMonth());
            ext.put("remainingThisMonth", s.remainingThisMonth());
            ext.put("periodStartUtc", s.periodStartUtc());
            ext.put("periodEndUtc", s.periodEndUtc());
            ext.put("subscriptionStartsAtUtc", s.subscriptionStartsAtUtc());
            ext.put("subscriptionEndsAtUtc", s.subscriptionEndsAtUtc());
        }
        return problem(HttpStatus.TOO_MANY_REQUESTS, "quota-exceeded", "Quota Exceeded",
                ex.getMessage(), request.getRequestURI(), null, ext);
    }

    // --- 429 Rate limit exceeded ---
    @ExceptionHandler(RateLimitExceededException.class)
    public ResponseEntity<ProblemDetail> handleRateLimitExceeded(RateLimitExceededException ex,
                                                                 HttpServletRequest request) {
        int retryAfter = Math.max(1, ex.getRetryAfterSeconds());
        var body = new ProblemDetail(
                BASE_TYPE + "rate-limit-exceeded",
                "Rate Limit Exceeded",
                HttpStatus.TOO_MANY_REQUESTS.value(),
                ex.getMessage(),
                request.getRequestURI(),
                LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
                null,
                Map.of("retryAfterSeconds", retryAfter)
        );
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header("Retry-After", String.valueOf(retryAfter))
                .contentType(PROBLEM_JSON)
                .body(body);
    }

    // --- 401/403 — let Spring Security handle these, do NOT swallow them ---
    @ExceptionHandler({AccessDeniedException.class, AuthenticationException.class})
    public void rethrowSecurityExceptions(RuntimeException ex) throws RuntimeException {
        throw ex;
    }

    // --- 404 No matching endpoint / static resource ---
    // A request to a path with no @RequestMapping (e.g. an endpoint that exists in a newer build
    // but is not yet deployed) throws NoResourceFoundException (Spring 6.1+) or NoHandlerFoundException.
    // Without an explicit handler these bubble to handleGeneral(Exception) and masquerade as a 500
    // "ERR-x" — making "this endpoint isn't deployed yet" look like a server crash. Map them to an
    // honest 404 instead. Logged at WARN (not ERROR) so missing-route probes don't pollute 500 alerts.
    @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
    public ResponseEntity<ProblemDetail> handleNoHandler(Exception ex, HttpServletRequest request) {
        log.warn("[404] No handler for {} {}", request.getMethod(), request.getRequestURI());
        return problem(HttpStatus.NOT_FOUND, "endpoint-not-found", "Endpoint Not Found",
                "The requested endpoint does not exist.", request.getRequestURI(), null, null);
    }

    // --- 500 fallback ---
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> handleGeneral(Exception ex,
                                                       HttpServletRequest request) {
        // Never leak the exception class/message to the client (it can expose table/column names,
        // JPQL, SQL fragments, internal paths). Log the full detail server-side under a reference
        // id and return only that reference so support can correlate without disclosure.
        String errorId = "ERR-" + Long.toHexString(ERROR_SEQ.incrementAndGet()).toUpperCase();
        log.error("[500][{}] Unhandled exception on {}", errorId, request.getRequestURI(), ex);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "internal-error", "Internal Server Error",
                "An unexpected error occurred. Reference: " + errorId, request.getRequestURI(), null, null);
    }

    // --- builder ---
    private ResponseEntity<ProblemDetail> problem(HttpStatus status,
                                                  String errorCode,
                                                  String title,
                                                  String detail,
                                                  String instance,
                                                  Map<String, String> errors,
                                                  Map<String, Object> extensions) {
        var body = new ProblemDetail(
                BASE_TYPE + errorCode,
                title,
                status.value(),
                detail,
                instance,
                LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
                errors,
                extensions
        );
        return ResponseEntity.status(status).contentType(PROBLEM_JSON).body(body);
    }

    /**
     * RFC 7807 Problem Detail record.
     * `errors` là extension field — chỉ có khi là validation error.
     */
    public record ProblemDetail(
            String type,
            String title,
            int status,
            String detail,
            String instance,
            String timestamp,
            Map<String, String> errors,           // nullable
            Map<String, Object> extensions        // nullable
    ) {}
}
