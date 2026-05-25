package com.deutschflow.speaking.exception;

/**
 * Thrown when the OpenAI API is unavailable after all retry attempts.
 * Mapped to HTTP 503 Service Unavailable by the GlobalExceptionHandler.
 */
public class AiServiceException extends RuntimeException {

    public AiServiceException(String message) {
        super(message);
    }

    public AiServiceException(String message, Throwable cause) {
        super(message, cause);
    }
}
