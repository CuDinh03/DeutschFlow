package com.deutschflow.payment.controller;

import com.deutschflow.payment.dto.CreateStripeSessionRequest;
import com.deutschflow.payment.dto.CreateStripeSessionResponse;
import com.deutschflow.payment.service.StripePaymentService;
import com.deutschflow.user.entity.User;
import com.stripe.exception.SignatureVerificationException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/payments/stripe")
@RequiredArgsConstructor
@Slf4j
public class StripePaymentController {

    private final StripePaymentService stripePaymentService;

    /**
     * Creates a Stripe Checkout session for the authenticated user.
     * Returns the session ID and the Stripe-hosted checkout URL.
     * The frontend should redirect to {@code url} to complete payment.
     */
    @PostMapping("/create-session")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<CreateStripeSessionResponse> createSession(
            @AuthenticationPrincipal User currentUser,
            @RequestBody CreateStripeSessionRequest request) {

        CreateStripeSessionResponse response = stripePaymentService.createCheckoutSession(
                currentUser.getId(), request.planCode());
        return ResponseEntity.ok(response);
    }

    /**
     * Stripe webhook endpoint — must receive the raw (unmodified) request body for
     * signature verification. No authentication required; Stripe signs each delivery.
     * <p>
     * Returns 200 on success, 400 when the signature cannot be verified, 503 when the webhook
     * secret is not configured, and 500 on other processing errors (so Stripe retries).
     */
    @PostMapping(value = "/webhook", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> handleWebhook(
            HttpServletRequest servletRequest,
            @RequestHeader(value = "Stripe-Signature", required = false) String sigHeader) {

        String payload;
        try {
            payload = new String(servletRequest.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            log.error("[STRIPE WEBHOOK] Failed to read request body", e);
            return ResponseEntity.badRequest().body("Failed to read request body");
        }

        try {
            stripePaymentService.handleWebhook(payload, sigHeader);
            return ResponseEntity.ok("OK");
        } catch (SignatureVerificationException e) {
            log.warn("[STRIPE WEBHOOK] Signature verification failed: {}", e.getMessage());
            return ResponseEntity.badRequest().body("Invalid Stripe signature");
        } catch (IllegalStateException e) {
            // Server misconfiguration (e.g. missing webhook secret). 503 → Stripe retries and the
            // failing deliveries surface the misconfiguration, instead of silently accepting events.
            log.error("[STRIPE WEBHOOK] Configuration error: {}", e.getMessage());
            return ResponseEntity.status(503).body("Webhook not configured");
        } catch (Exception e) {
            log.error("[STRIPE WEBHOOK] Unexpected error processing webhook", e);
            // Return 500 (not 200) so Stripe retries transient failures, rather than the event
            // being dropped after the user has already paid. Activation is idempotent on tx status.
            return ResponseEntity.internalServerError().body("Internal error");
        }
    }
}
