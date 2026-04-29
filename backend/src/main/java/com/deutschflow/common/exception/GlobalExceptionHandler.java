package com.deutschflow.common.exception;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Global exception handler — RFC 7807 Problem Details (application/problem+json)
 *
 * Success responses: trả về data trực tiếp với HTTP 200/201/204.
 * Error responses: trả về ProblemDetail với Content-Type: application/problem+json.
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    private static final String BASE_TYPE = "https://deutschflow.com/errors/";
    private static final MediaType PROBLEM_JSON = MediaType.valueOf("application/problem+json");

    // --- 400 Bad Request ---
    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<ProblemDetail> handleBadRequest(BadRequestException ex,
                                                          HttpServletRequest request) {
        return problem(HttpStatus.BAD_REQUEST, "bad-request", "Bad Request",
                ex.getMessage(), request.getRequestURI(), null);
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
                "One or more fields are invalid.", request.getRequestURI(), errors);
    }

    // --- 409 Conflict ---
    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ProblemDetail> handleConflict(ConflictException ex,
                                                        HttpServletRequest request) {
        return problem(HttpStatus.CONFLICT, "conflict", "Conflict",
                ex.getMessage(), request.getRequestURI(), null);
    }

    // --- 403 Forbidden ---
    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<ProblemDetail> handleForbidden(ForbiddenException ex,
                                                         HttpServletRequest request) {
        return problem(HttpStatus.FORBIDDEN, "forbidden", "Forbidden",
                ex.getMessage(), request.getRequestURI(), null);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ProblemDetail> handleAccessDenied(AccessDeniedException ex,
                                                            HttpServletRequest request) {
        return problem(HttpStatus.FORBIDDEN, "forbidden", "Forbidden",
                "You do not have permission to access this resource.",
                request.getRequestURI(), null);
    }

    // --- 404 Not Found ---
    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ProblemDetail> handleNotFound(NotFoundException ex,
                                                        HttpServletRequest request) {
        return problem(HttpStatus.NOT_FOUND, "not-found", "Not Found",
                ex.getMessage(), request.getRequestURI(), null);
    }

    /**
     * Client aborted the connection (browser tab refresh/navigation, proxy timeout, etc.).
     * This is not a server error and we cannot write a response anyway.
     */
    @ExceptionHandler(AsyncRequestNotUsableException.class)
    public ResponseEntity<Void> handleClientAbort(AsyncRequestNotUsableException ex,
                                                  HttpServletRequest request) {
        // Keep logs clean: this happens when the client disconnects mid-response.
        log.debug("Client aborted connection at {}: {}", request.getRequestURI(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    // --- 500 fallback ---
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> handleGeneral(Exception ex,
                                                       HttpServletRequest request) {
        log.error("Unhandled exception at {}", request.getRequestURI(), ex);
        // Không expose stack trace ra ngoài
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "internal-error", "Internal Server Error",
                "An unexpected error occurred. Please try again later.",
                request.getRequestURI(), null);
    }

    // --- builder ---
    private ResponseEntity<ProblemDetail> problem(HttpStatus status,
                                                  String errorCode,
                                                  String title,
                                                  String detail,
                                                  String instance,
                                                  Map<String, String> errors) {
        var body = new ProblemDetail(
                BASE_TYPE + errorCode,
                title,
                status.value(),
                detail,
                instance,
                LocalDateTime.now(),
                errors
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
            LocalDateTime timestamp,
            Map<String, String> errors   // nullable
    ) {}
}
