package com.deutschflow.common.exception;

/**
 * Raised when a coin spend is attempted with an insufficient balance. Extends {@link
 * ConflictException} so the existing 409 handler maps it without a new advice — the user-facing
 * message is carried verbatim. The frontend disables the spend CTA when the balance is too low, so
 * this is primarily a server-side safety net against races / direct API calls.
 */
public class InsufficientCoinsException extends ConflictException {
    public InsufficientCoinsException(String message) {
        super(message);
    }
}
