package com.deutschflow.payment.apple;

import com.apple.itunes.storekit.model.Data;
import com.apple.itunes.storekit.model.Environment;
import com.apple.itunes.storekit.model.JWSTransactionDecodedPayload;
import com.apple.itunes.storekit.model.NotificationTypeV2;
import com.apple.itunes.storekit.model.ResponseBodyV2DecodedPayload;
import com.apple.itunes.storekit.model.Subtype;
import com.apple.itunes.storekit.verification.VerificationException;
import com.deutschflow.payment.service.SubscriptionActivationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * Handles App Store Server Notifications V2 — Apple's server-to-server lifecycle feed (renew, cancel,
 * refund, expire, …), the auto-renew analogue of the Stripe webhook. Each notification is verified, the
 * user is correlated via {@code originalTransactionId} (falling back to {@code appAccountToken}), and the
 * provider-agnostic entitlement is updated through {@link SubscriptionActivationService}.
 */
@Service
@Slf4j
public class AppleServerNotificationService {

    private final AppleJwsVerifier verifier;
    private final AppleProductCatalog productCatalog;
    private final AppleSubscriptionStore store;
    private final SubscriptionActivationService activationService;

    public AppleServerNotificationService(AppleJwsVerifier verifier,
                                          AppleProductCatalog productCatalog,
                                          AppleSubscriptionStore store,
                                          SubscriptionActivationService activationService) {
        this.verifier = verifier;
        this.productCatalog = productCatalog;
        this.store = store;
        this.activationService = activationService;
    }

    /**
     * Maps an Apple notification (type + subtype) to its entitlement effect. Pure and total so it can be
     * unit-tested exhaustively without constructing signed payloads.
     */
    public static AppleEntitlementAction decideAction(NotificationTypeV2 type, Subtype subtype) {
        if (type == null) {
            return AppleEntitlementAction.IGNORE;
        }
        return switch (type) {
            case SUBSCRIBED, OFFER_REDEEMED, REFUND_REVERSED -> AppleEntitlementAction.GRANT;
            case DID_RENEW, RENEWAL_EXTENDED, RENEWAL_EXTENSION -> AppleEntitlementAction.EXTEND;
            case DID_CHANGE_RENEWAL_STATUS -> AppleEntitlementAction.UPDATE_RENEWAL_FLAG;
            case DID_FAIL_TO_RENEW -> subtype == Subtype.GRACE_PERIOD
                    ? AppleEntitlementAction.SET_GRACE
                    : AppleEntitlementAction.IGNORE; // wait for the EXPIRED notification
            case EXPIRED, GRACE_PERIOD_EXPIRED, REVOKE -> AppleEntitlementAction.END;
            case REFUND -> AppleEntitlementAction.REFUND;
            // DID_CHANGE_RENEWAL_PREF (down/cross-grade) applies on the next renewal, carried by DID_RENEW.
            // PRICE_INCREASE, CONSUMPTION_REQUEST, REFUND_DECLINED, ONE_TIME_CHARGE, TEST, etc. are informational.
            default -> AppleEntitlementAction.IGNORE;
        };
    }

    /** Verify and process a raw {@code signedPayload} from Apple. Always returns; failures are logged. */
    @Transactional
    public void handle(String signedPayload) {
        if (!verifier.isEnabled()) {
            log.warn("[APPLE NOTIFY] Verifier disabled — ignoring notification.");
            return;
        }
        if (signedPayload == null || signedPayload.isBlank()) {
            throw new IllegalArgumentException("Empty Apple notification payload.");
        }
        final ResponseBodyV2DecodedPayload payload;
        try {
            payload = verifier.verifyNotification(signedPayload);
        } catch (VerificationException e) {
            log.error("[APPLE NOTIFY] Signature verification failed — rejecting notification.", e);
            throw new IllegalArgumentException("Invalid Apple notification signature");
        }

        NotificationTypeV2 type = payload.getNotificationType();
        Subtype subtype = payload.getSubtype();
        log.info("[APPLE NOTIFY] type={} subtype={} uuid={}", type, subtype, payload.getNotificationUUID());

        if (type == NotificationTypeV2.TEST) {
            log.info("[APPLE NOTIFY] TEST notification acknowledged.");
            return;
        }

        // Exactly-once guard: Apple delivers at-least-once. Recorded inside this transaction, so a failure
        // downstream rolls the mark back and Apple's retry reprocesses cleanly.
        if (!store.markNotificationProcessedIfNew(payload.getNotificationUUID(), type != null ? type.name() : null)) {
            log.info("[APPLE NOTIFY] Duplicate delivery uuid={} — already processed, skipping.", payload.getNotificationUUID());
            return;
        }

        Data data = payload.getData();
        if (data == null || data.getSignedTransactionInfo() == null) {
            log.info("[APPLE NOTIFY] No transaction info on type={} — nothing to apply.", type);
            return;
        }

        final JWSTransactionDecodedPayload txn;
        try {
            txn = verifier.verifyTransaction(data.getSignedTransactionInfo());
        } catch (VerificationException e) {
            log.error("[APPLE NOTIFY] Transaction signature verification failed.", e);
            throw new IllegalArgumentException("Invalid Apple transaction signature");
        }

        String originalTransactionId = txn.getOriginalTransactionId();
        String productId = txn.getProductId();
        UUID appAccountToken = txn.getAppAccountToken();

        Optional<Long> userIdOpt = store.findUserIdByOriginalTransactionId(originalTransactionId)
                .or(() -> store.findUserIdByAppAccountToken(appAccountToken));
        if (userIdOpt.isEmpty()) {
            log.warn("[APPLE NOTIFY] Could not correlate notification to a user (origTxId={}, appAccountToken={}). "
                    + "Acknowledging; client /verify or /sync will reconcile.", originalTransactionId, appAccountToken);
            return;
        }
        long userId = userIdOpt.get();

        Optional<AppleProductCatalog.AppleProduct> productOpt = productCatalog.find(productId);
        if (productOpt.isEmpty()) {
            log.warn("[APPLE NOTIFY] Unknown product {} for userId={} — ignoring.", productId, userId);
            return;
        }
        String planCode = productOpt.get().planCode();

        AppleEntitlementAction action = decideAction(type, subtype);
        Instant expiresAt = txn.getExpiresDate() != null ? Instant.ofEpochMilli(txn.getExpiresDate()) : null;
        Instant startsAt = txn.getPurchaseDate() != null ? Instant.ofEpochMilli(txn.getPurchaseDate()) : Instant.now();
        String environment = data.getEnvironment() != null ? data.getEnvironment().getValue() : Environment.SANDBOX.getValue();

        applyAction(action, userId, originalTransactionId, productId, planCode, txn.getTransactionId(),
                startsAt, expiresAt, environment, subtype);
    }

    private void applyAction(AppleEntitlementAction action, long userId, String originalTransactionId,
                             String productId, String planCode, String latestTransactionId,
                             Instant startsAt, Instant expiresAt, String environment, Subtype subtype) {
        // Admin "learner subscribed" notifications are fired by the client-driven /verify path; the
        // server-to-server notification path stays silent (notify=false) to avoid duplicate admin alerts.
        switch (action) {
            case GRANT -> {
                store.upsert(originalTransactionId, userId, productId, planCode, "ACTIVE",
                        expiresAt, Boolean.TRUE, environment, latestTransactionId);
                activationService.extendOrActivateApple(userId, planCode, startsAt, expiresAt, false);
            }
            case EXTEND -> {
                store.upsert(originalTransactionId, userId, productId, planCode, "ACTIVE",
                        expiresAt, Boolean.TRUE, environment, latestTransactionId);
                activationService.extendOrActivateApple(userId, planCode, startsAt, expiresAt, false);
            }
            case SET_GRACE -> {
                store.upsert(originalTransactionId, userId, productId, planCode, "GRACE",
                        expiresAt, Boolean.TRUE, environment, latestTransactionId);
                // The grace transaction's expiresDate covers the billing-retry window — keep access until then.
                activationService.extendOrActivateApple(userId, planCode, startsAt, expiresAt, false);
                log.info("[APPLE NOTIFY] userId={} entered billing grace period — entitlement retained until {}.", userId, expiresAt);
            }
            case UPDATE_RENEWAL_FLAG -> {
                store.updateAutoRenew(originalTransactionId, subtype == Subtype.AUTO_RENEW_ENABLED);
                log.info("[APPLE NOTIFY] userId={} auto-renew {}", userId,
                        subtype == Subtype.AUTO_RENEW_ENABLED ? "enabled" : "disabled");
            }
            case END -> {
                store.markStatus(originalTransactionId, "EXPIRED");
                activationService.endAppleSubscription(userId);
            }
            case REFUND -> {
                store.markStatus(originalTransactionId, "REFUNDED");
                activationService.endAppleSubscription(userId);
                // Follow-up: surface a user-facing refund notification (needs a NotificationType.REFUND entry).
                log.info("[APPLE NOTIFY] Refund processed for userId={} — entitlement ended.", userId);
            }
            case IGNORE -> log.info("[APPLE NOTIFY] No entitlement change for userId={}.", userId);
        }
    }
}
