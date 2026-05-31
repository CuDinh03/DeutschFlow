package com.deutschflow.payment.dto;

/**
 * Response for POST /api/payments/stripe/create-session.
 * sessionId: Stripe Checkout session ID (cs_test_...).
 * url: Stripe-hosted checkout URL — redirect the user here.
 */
public record CreateStripeSessionResponse(String sessionId, String url) {
}
