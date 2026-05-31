package com.deutschflow.payment.dto;

/**
 * Request body for POST /api/payments/stripe/create-session.
 * planCode must match a code in the subscription_plans table (e.g. "PRO", "ULTRA").
 */
public record CreateStripeSessionRequest(String planCode) {
}
