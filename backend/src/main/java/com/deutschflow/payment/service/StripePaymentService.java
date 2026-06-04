package com.deutschflow.payment.service;

import com.deutschflow.payment.dto.CreateStripeSessionResponse;
import com.deutschflow.payment.entity.PaymentTransaction;
import com.deutschflow.payment.repository.PaymentTransactionRepository;
import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import com.stripe.param.checkout.SessionCreateParams;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Stripe Checkout integration.
 * <p>
 * Flow: createCheckoutSession → Stripe-hosted page → checkout.session.completed webhook → activatePlan.
 * <p>
 * All money amounts are in USD cents (Stripe requirement).
 * VND prices are converted: priceUsdCents = round((priceVnd / 25_000.0) * 100).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class StripePaymentService {

    @Value("${payment.stripe.secret-key:}")
    private String secretKey;

    @Value("${payment.stripe.webhook-secret:}")
    private String webhookSecret;

    @Value("${payment.stripe.success-url:https://mydeutschflow.com/student/pricing?stripe=success}")
    private String successUrl;

    @Value("${payment.stripe.cancel-url:https://mydeutschflow.com/student/pricing?stripe=cancel}")
    private String cancelUrl;

    private final PaymentTransactionRepository paymentTransactionRepository;
    private final JdbcTemplate jdbcTemplate;
    private final SubscriptionActivationService subscriptionActivationService;

    @PostConstruct
    void init() {
        if (secretKey == null || secretKey.isBlank()) {
            log.warn("[STRIPE] STRIPE_SECRET_KEY is not configured — Stripe payment is disabled.");
            return;
        }
        Stripe.apiKey = secretKey;
        log.info("[STRIPE] Stripe SDK initialized. success-url={} cancel-url={}", successUrl, cancelUrl);
    }

    // ==================== CREATE CHECKOUT SESSION ====================

    @Transactional
    public CreateStripeSessionResponse createCheckoutSession(long userId, String planCode) {
        if (secretKey == null || secretKey.isBlank()) {
            throw new IllegalStateException("Stripe is not configured on this server. Please contact support.");
        }

        // 1. Look up price and duration from subscription_plans
        var planRow = jdbcTemplate.queryForMap(
                "SELECT price_vnd, duration_months FROM subscription_plans WHERE code = ? AND is_active = TRUE",
                planCode
        );
        long priceVnd = ((Number) planRow.get("price_vnd")).longValue();
        int durationMonths = planRow.get("duration_months") != null
                ? ((Number) planRow.get("duration_months")).intValue()
                : 1;
        if (priceVnd <= 0) {
            throw new IllegalArgumentException("Plan " + planCode + " does not have a valid price.");
        }

        // 2. Convert VND to USD cents (1 USD ≈ 25,000 VND)
        long priceUsdCents = Math.round((priceVnd / 25_000.0) * 100);
        if (priceUsdCents < 50) {
            // Stripe minimum is 50 cents ($0.50)
            priceUsdCents = 50;
        }

        // 3. Build Stripe Session
        try {
            SessionCreateParams params = SessionCreateParams.builder()
                    .setMode(SessionCreateParams.Mode.PAYMENT)
                    .setSuccessUrl(successUrl)
                    .setCancelUrl(cancelUrl)
                    .addLineItem(
                            SessionCreateParams.LineItem.builder()
                                    .setQuantity(1L)
                                    .setPriceData(
                                            SessionCreateParams.LineItem.PriceData.builder()
                                                    .setCurrency("usd")
                                                    .setUnitAmount(priceUsdCents)
                                                    .setProductData(
                                                            SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                                                    .setName("DeutschFlow " + planCode)
                                                                    .build()
                                                    )
                                                    .build()
                                    )
                                    .build()
                    )
                    .putMetadata("userId", String.valueOf(userId))
                    .putMetadata("planCode", planCode)
                    .putMetadata("durationMonths", String.valueOf(durationMonths))
                    .build();

            Session session = Session.create(params);

            // 4. Save PENDING PaymentTransaction
            PaymentTransaction tx = PaymentTransaction.builder()
                    .orderId(session.getId())
                    .userId(userId)
                    .planCode(planCode)
                    .amount(priceVnd)
                    .durationMonths(durationMonths)
                    .provider("STRIPE")
                    .status("PENDING")
                    .build();
            paymentTransactionRepository.save(tx);

            log.info("[STRIPE] Created session={} userId={} plan={} priceVnd={} priceUsdCents={}",
                    session.getId(), userId, planCode, priceVnd, priceUsdCents);

            return new CreateStripeSessionResponse(session.getId(), session.getUrl());

        } catch (com.stripe.exception.StripeException e) {
            log.error("[STRIPE] Failed to create checkout session for userId={} plan={}", userId, planCode, e);
            throw new RuntimeException("Failed to create Stripe checkout session: " + e.getMessage(), e);
        }
    }

    // ==================== WEBHOOK ====================

    @Transactional
    public void handleWebhook(String payload, String sigHeader) throws SignatureVerificationException {
        if (webhookSecret == null || webhookSecret.isBlank()) {
            log.warn("[STRIPE WEBHOOK] webhook-secret is not configured — skipping signature verification.");
            return;
        }

        Event event = Webhook.constructEvent(payload, sigHeader, webhookSecret);
        log.info("[STRIPE WEBHOOK] Received event type={} id={}", event.getType(), event.getId());

        if (!"checkout.session.completed".equals(event.getType())) {
            log.debug("[STRIPE WEBHOOK] Ignoring event type={}", event.getType());
            return;
        }

        // Deserialize the session object from the event
        com.stripe.model.StripeObject stripeObject = event.getDataObjectDeserializer()
                .getObject()
                .orElse(null);

        if (!(stripeObject instanceof Session session)) {
            log.warn("[STRIPE WEBHOOK] Could not deserialize Session from event id={}", event.getId());
            return;
        }

        String sessionId = session.getId();
        java.util.Map<String, String> metadata = session.getMetadata();

        if (metadata == null) {
            log.error("[STRIPE WEBHOOK] No metadata on session={}", sessionId);
            return;
        }

        String userIdStr = metadata.get("userId");
        String planCode = metadata.get("planCode");
        String durationMonthsStr = metadata.get("durationMonths");

        if (userIdStr == null || planCode == null) {
            log.error("[STRIPE WEBHOOK] Missing userId or planCode in metadata for session={}", sessionId);
            return;
        }

        long userId;
        int durationMonths;
        try {
            userId = Long.parseLong(userIdStr);
            durationMonths = durationMonthsStr != null ? Integer.parseInt(durationMonthsStr) : 1;
        } catch (NumberFormatException e) {
            log.error("[STRIPE WEBHOOK] Invalid metadata values for session={}", sessionId, e);
            return;
        }

        // Find and update the PaymentTransaction
        PaymentTransaction tx = paymentTransactionRepository.findByOrderId(sessionId).orElse(null);
        if (tx == null) {
            log.warn("[STRIPE WEBHOOK] PaymentTransaction not found for session={} — creating fallback record", sessionId);
            // Create a fallback record in case webhook arrived before session was saved (rare race condition)
            tx = PaymentTransaction.builder()
                    .orderId(sessionId)
                    .userId(userId)
                    .planCode(planCode)
                    .amount(0L)
                    .durationMonths(durationMonths)
                    .provider("STRIPE")
                    .status("PENDING")
                    .build();
        }

        if ("SUCCESS".equals(tx.getStatus())) {
            log.info("[STRIPE WEBHOOK] Idempotent replay — session={} already completed", sessionId);
            return;
        }

        tx.setStatus("SUCCESS");
        tx.setProviderTransactionId(session.getPaymentIntent());
        paymentTransactionRepository.save(tx);

        // Activate subscription
        subscriptionActivationService.activatePlan(userId, planCode, durationMonths);

        log.info("[STRIPE WEBHOOK] checkout.session.completed — activated plan={} for userId={} session={}",
                planCode, userId, sessionId);
    }
}
