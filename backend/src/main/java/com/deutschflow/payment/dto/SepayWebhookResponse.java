package com.deutschflow.payment.dto;

/**
 * Ack body for {@code POST /api/payments/sepay/webhook} (server-to-server) — mirrors the legacy
 * {@code {success}} map. {@code false} on auth failure (401), {@code true} once handled (200).
 */
public record SepayWebhookResponse(boolean success) {}
