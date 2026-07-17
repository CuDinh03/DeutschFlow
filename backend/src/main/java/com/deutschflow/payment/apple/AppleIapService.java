package com.deutschflow.payment.apple;

import com.apple.itunes.storekit.model.JWSTransactionDecodedPayload;
import com.apple.itunes.storekit.verification.VerificationException;
import com.deutschflow.payment.entity.PaymentTransaction;
import com.deutschflow.payment.repository.PaymentTransactionRepository;
import com.deutschflow.payment.service.SubscriptionActivationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Processes StoreKit 2 purchases the client submits after a successful in-app purchase
 * ({@code POST /verify}) or restore ({@code POST /sync}). Verifies the signed transaction locally,
 * records an idempotent {@link PaymentTransaction} (provider {@code APPLE}), updates the Apple ledger,
 * and activates the provider-agnostic entitlement.
 */
@Service
@Slf4j
public class AppleIapService {

    /** Result of activating an Apple purchase — enough for the client to reflect state before re-fetching the plan. */
    public record AppleActivationResult(String planCode, Instant endsAt) {}

    private final AppleJwsVerifier verifier;
    private final AppleProductCatalog productCatalog;
    private final AppleSubscriptionStore store;
    private final SubscriptionActivationService activationService;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final AppleIapMetrics metrics;
    private final TransactionTemplate transactionTemplate;

    public AppleIapService(AppleJwsVerifier verifier,
                           AppleProductCatalog productCatalog,
                           AppleSubscriptionStore store,
                           SubscriptionActivationService activationService,
                           PaymentTransactionRepository paymentTransactionRepository,
                           AppleIapMetrics metrics,
                           PlatformTransactionManager transactionManager) {
        this.verifier = verifier;
        this.productCatalog = productCatalog;
        this.store = store;
        this.activationService = activationService;
        this.paymentTransactionRepository = paymentTransactionRepository;
        this.metrics = metrics;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    /** Verify a single signed transaction for {@code userId} and activate the entitlement. */
    @Transactional
    public AppleActivationResult verifyAndActivate(long userId, String signedTransaction) {
        return doVerifyAndActivate(userId, signedTransaction);
    }

    /**
     * Core verify-and-activate, free of {@code @Transactional} so it can be driven either by the proxied
     * {@link #verifyAndActivate} ({@code /verify}) or wrapped per-item by {@link #syncEntitlements} — avoiding
     * the self-invocation pitfall where an inner {@code @Transactional} call would silently lose its boundary.
     */
    private AppleActivationResult doVerifyAndActivate(long userId, String signedTransaction) {
        if (!verifier.isEnabled()) {
            throw new IllegalStateException("Apple IAP is not configured on this server.");
        }
        if (signedTransaction == null || signedTransaction.isBlank()) {
            throw new IllegalArgumentException("Missing signed transaction.");
        }

        final JWSTransactionDecodedPayload txn;
        try {
            // SignedDataVerifier also enforces bundleId + environment; throws on mismatch.
            txn = verifier.verifyTransaction(signedTransaction);
        } catch (VerificationException e) {
            log.warn("[APPLE VERIFY] Signature verification failed for userId={}", userId, e);
            throw new IllegalArgumentException("Invalid Apple transaction.");
        }

        AppleProductCatalog.AppleProduct product = productCatalog.find(txn.getProductId())
                .orElseThrow(() -> {
                    log.warn("[APPLE VERIFY] Unknown product {} for userId={}", txn.getProductId(), userId);
                    return new IllegalArgumentException("Unrecognized product.");
                });

        String transactionId = txn.getTransactionId();
        String originalTransactionId = txn.getOriginalTransactionId();
        Instant expiresAt = txn.getExpiresDate() != null ? Instant.ofEpochMilli(txn.getExpiresDate()) : null;
        Instant startsAt = txn.getPurchaseDate() != null ? Instant.ofEpochMilli(txn.getPurchaseDate()) : Instant.now();
        String environment = txn.getEnvironment() != null ? txn.getEnvironment().getValue() : "Sandbox";

        // Bind the transaction to the requesting account. Apple's signature proves the JWS is authentic, not
        // that it belongs to THIS user — without this check, user B could replay user A's JWS to gain a paid plan.
        UUID jwsAppAccountToken = txn.getAppAccountToken();
        if (jwsAppAccountToken != null) {
            UUID expected = store.getOrCreateAppAccountToken(userId);
            if (!jwsAppAccountToken.equals(expected)) {
                log.warn("[APPLE VERIFY] appAccountToken mismatch for userId={} — rejecting cross-account transaction.", userId);
                throw new IllegalArgumentException("Transaction does not belong to this account.");
            }
        }

        // Idempotency: order_id = Apple transactionId is UNIQUE. A replayed transaction is a no-op activation.
        Optional<PaymentTransaction> existing = paymentTransactionRepository.findByOrderId(transactionId);
        if (existing.isPresent() && !existing.get().getUserId().equals(userId)) {
            log.warn("[APPLE VERIFY] transactionId={} already owned by another user — rejecting replay for userId={}",
                    transactionId, userId);
            throw new IllegalArgumentException("Transaction does not belong to this account.");
        }
        boolean isNew = existing.isEmpty();
        if (existing.isPresent() && "SUCCESS".equals(existing.get().getStatus())) {
            log.info("[APPLE VERIFY] Idempotent replay — transactionId={} already recorded for userId={}", transactionId, userId);
        } else {
            recordTransaction(existing.orElse(null), userId, product.planCode(), product.durationMonths(),
                    transactionId, originalTransactionId, txn.getProductId(), environment, expiresAt);
        }

        store.upsert(originalTransactionId, userId, txn.getProductId(), product.planCode(), "ACTIVE",
                expiresAt, Boolean.TRUE, environment, transactionId);

        // Notify admins only on the first time we see this transaction.
        activationService.extendOrActivateApple(userId, product.planCode(), startsAt, expiresAt, isNew);

        // Observability: tag by StoreKit environment so Sandbox activations on the prod server are
        // visible (the verifier accepts both environments by design — see AppleIapMetrics).
        // Guarded: a metrics failure must NEVER roll back an activation that already succeeded.
        try {
            metrics.recordActivation(environment, product.planCode(), isNew);
        } catch (RuntimeException e) {
            log.warn("[APPLE VERIFY] Failed to record activation metric (non-fatal)", e);
        }

        log.info("[APPLE VERIFY] Activated plan={} for userId={} (transactionId={}, environment={}, until={})",
                product.planCode(), userId, transactionId, environment, expiresAt);
        return new AppleActivationResult(product.planCode(), expiresAt);
    }

    /**
     * Restore / reconcile: verify every current entitlement the client holds, keeping the one that extends
     * furthest. Each item runs in its OWN transaction so one bad entitlement cannot roll back the others.
     */
    public AppleActivationResult syncEntitlements(long userId, List<String> signedTransactions) {
        if (signedTransactions == null || signedTransactions.isEmpty()) {
            return null;
        }
        AppleActivationResult latest = null;
        for (String jws : signedTransactions) {
            try {
                AppleActivationResult r = transactionTemplate.execute(status -> doVerifyAndActivate(userId, jws));
                if (r != null && (latest == null || (r.endsAt() != null
                        && (latest.endsAt() == null || r.endsAt().isAfter(latest.endsAt()))))) {
                    latest = r;
                }
            } catch (RuntimeException e) {
                log.warn("[APPLE SYNC] Skipping an entitlement for userId={}: {}", userId, e.getMessage());
            }
        }
        return latest;
    }

    private void recordTransaction(PaymentTransaction existing, long userId, String planCode, int durationMonths,
                                   String transactionId, String originalTransactionId, String productId,
                                   String environment, Instant expiresAt) {
        Map<String, Object> raw = new HashMap<>();
        raw.put("productId", productId);
        raw.put("originalTransactionId", originalTransactionId);
        raw.put("environment", environment);
        raw.put("expiresAt", expiresAt != null ? expiresAt.toString() : null);

        PaymentTransaction tx = existing != null ? existing : PaymentTransaction.builder()
                .orderId(transactionId)
                .userId(userId)
                .planCode(planCode)
                .amount(0L) // Apple manages price per storefront; revenue reconciled via App Store Connect.
                .durationMonths(durationMonths)
                .provider("APPLE")
                .build();
        tx.setStatus("SUCCESS");
        tx.setProviderTransactionId(originalTransactionId);
        tx.setRawIpnPayload(raw);
        paymentTransactionRepository.save(tx);
    }
}
