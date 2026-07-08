package com.deutschflow.common.exception;

import com.deutschflow.common.quota.QuotaExceededException;
import com.deutschflow.common.exception.RateLimitExceededException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
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

    // --- 400 Type mismatch (e.g. date-only string where datetime is expected) --- [F-1]
    // e.g. GET /class-schedule/week?from=2026-06-22 when @DateTimeFormat(ISO.DATE_TIME) is required.
    @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ProblemDetail> handleTypeMismatch(
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException ex,
            HttpServletRequest request) {
        return problem(HttpStatus.BAD_REQUEST, "bad-request", "Bad Request",
                "Tham số '" + ex.getName() + "' sai kiểu hoặc định dạng. "
                        + "Datetime phải theo ISO 8601: 2026-06-22T00:00:00",
                request.getRequestURI(), null, null);
    }

    // --- 400 Missing multipart part (e.g. pronunciation check without audio field) --- [PRON]
    @ExceptionHandler(org.springframework.web.multipart.support.MissingServletRequestPartException.class)
    public ResponseEntity<ProblemDetail> handleMissingPart(
            org.springframework.web.multipart.support.MissingServletRequestPartException ex,
            HttpServletRequest request) {
        return problem(HttpStatus.BAD_REQUEST, "bad-request", "Bad Request",
                "Trường '" + ex.getRequestPartName() + "' là bắt buộc trong multipart request.",
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

    // --- 409 Optimistic lock — a concurrent update lost the race (auto-grade audit, Đợt 3) ---
    // @Version on student_assignments makes a stale write throw ObjectOptimisticLockingFailureException.
    // Without this it would bubble to handleGeneral as a scary 500; map it to a retryable 409 so a
    // double-submit / simultaneous grade+evaluate degrades gracefully. (The async grade path catches
    // this itself and no-ops via its EVALUATED/GRADED guard, so this mainly covers user-facing saves.)
    @ExceptionHandler(org.springframework.orm.ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ProblemDetail> handleOptimisticLock(
            org.springframework.orm.ObjectOptimisticLockingFailureException ex, HttpServletRequest request) {
        log.warn("[409] Optimistic lock conflict on {}: {}", request.getRequestURI(), ex.getMessage());
        return problem(HttpStatus.CONFLICT, "conflict", "Conflict",
                "Bản ghi vừa được cập nhật bởi một thao tác khác. Vui lòng tải lại và thử lại.",
                request.getRequestURI(), null, null);
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

    // --- 503 — upstream AI provider unavailable / returned nothing usable ---
    @ExceptionHandler(com.deutschflow.speaking.exception.AiServiceException.class)
    public ResponseEntity<ProblemDetail> handleAiServiceUnavailable(
            com.deutschflow.speaking.exception.AiServiceException ex,
            HttpServletRequest request) {
        return problem(HttpStatus.SERVICE_UNAVAILABLE, "ai-unavailable", "AI Service Unavailable",
                ex.getMessage(), request.getRequestURI(), null, null);
    }

    // --- 503 — AI provider bean not configured (e.g. Bedrock disabled, missing env vars) ---
    // IllegalStateException from ObjectProvider.getIfAvailable when no ImageGenerationProvider bean
    // is registered would otherwise fall through to handleGeneral and masquerade as a scary 500 "ERR-x".
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ProblemDetail> handleIllegalState(IllegalStateException ex,
                                                            HttpServletRequest request) {
        log.warn("[503] Service not configured on {}: {}", request.getRequestURI(), ex.getMessage());
        return problem(HttpStatus.SERVICE_UNAVAILABLE, "ai-unavailable", "AI Service Unavailable",
                "Tính năng AI này chưa được cấu hình trên môi trường hiện tại. Vui lòng thử lại sau.",
                request.getRequestURI(), null, null);
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

    // --- 409 Data integrity (FK / unique / not-null violations) ---
    // A bad FK (e.g. an unknown organizations.plan_code) or a unique-race would otherwise bubble to
    // handleGeneral and masquerade as a 500 "ERR-x". Map it to an honest 409 with a generic,
    // non-leaking message (DB driver messages expose table/column/constraint names). WARN, not ERROR,
    // so client-data conflicts don't pollute 500 alerts; the most-specific cause is logged for support.
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ProblemDetail> handleDataIntegrity(DataIntegrityViolationException ex,
                                                             HttpServletRequest request) {
        String errorId = "ERR-" + Long.toHexString(ERROR_SEQ.incrementAndGet()).toUpperCase();
        log.warn("[409][{}] Data integrity violation on {}: {}", errorId, request.getRequestURI(),
                ex.getMostSpecificCause().getMessage());
        return problem(HttpStatus.CONFLICT, "data-integrity", "Vi phạm ràng buộc dữ liệu",
                "Dữ liệu không hợp lệ hoặc vi phạm ràng buộc (ví dụ: mã gói không tồn tại, hoặc giá trị bị trùng). "
                        + "Reference: " + errorId, request.getRequestURI(), null, null);
    }

    // --- 503 — database temporarily unavailable (pool exhausted / DB unreachable) ---
    // When a request cannot OBTAIN a DB connection — Hikari pool exhausted within connection-timeout
    // (5s) or Postgres unreachable — Spring throws DataAccessResourceFailureException /
    // CannotGetJdbcConnectionException, or — for @Transactional methods, where it fails at tx-begin —
    // CannotCreateTransactionException. Without this they bubble to handleGeneral and masquerade as a
    // scary 500 "ERR-x" — that was the ERR-161 / ERR-74C login incident. Map to an HONEST, RETRYABLE
    // 503 + Retry-After so clients (and the FE's idempotent-retry) back off instead of treating a
    // transient DB blip as a hard crash. ERROR-logged with a reference for support correlation; the
    // client message stays generic (no pool/SQL internals).
    @ExceptionHandler({
            org.springframework.dao.DataAccessResourceFailureException.class,
            org.springframework.transaction.CannotCreateTransactionException.class
    })
    public ResponseEntity<ProblemDetail> handleDbUnavailable(Exception ex, HttpServletRequest request) {
        String errorId = "ERR-" + Long.toHexString(ERROR_SEQ.incrementAndGet()).toUpperCase();
        log.error("[503][{}] Database temporarily unavailable on {}", errorId, request.getRequestURI(), ex);
        int retryAfter = 3;
        var body = new ProblemDetail(
                BASE_TYPE + "db-unavailable",
                "Service Temporarily Unavailable",
                HttpStatus.SERVICE_UNAVAILABLE.value(),
                "Hệ thống đang bận tạm thời, vui lòng thử lại sau giây lát. Reference: " + errorId,
                request.getRequestURI(),
                LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
                null,
                Map.of("retryAfterSeconds", retryAfter)
        );
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .header("Retry-After", String.valueOf(retryAfter))
                .contentType(PROBLEM_JSON)
                .body(body);
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
