package com.deutschflow.payment.controller;

import com.deutschflow.payment.apple.AppleIapService;
import com.deutschflow.payment.apple.AppleIapService.AppleActivationResult;
import com.deutschflow.payment.apple.AppleProductCatalog;
import com.deutschflow.payment.apple.AppleServerNotificationService;
import com.deutschflow.payment.apple.AppleSubscriptionStore;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Apple StoreKit IAP endpoints. Native iOS submits signed StoreKit 2 transactions here; Apple posts
 * server-to-server lifecycle notifications to {@code /notifications}. Entitlement is reconciled into the
 * provider-agnostic subscription layer — clients read the canonical tier from {@code /api/auth/me/plan}.
 */
@RestController
@RequestMapping("/api/payments/apple")
@RequiredArgsConstructor
@Slf4j
public class AppleIapController {

    public record AppleVerifyRequest(String jws) {}
    public record AppleSyncRequest(List<String> jws) {}
    public record AppleNotificationPayload(String signedPayload) {}
    public record AppleAccountTokenResponse(String appAccountToken) {}
    public record AppleProductResponse(String productId, String planCode, int durationMonths) {}

    /** Error body for {@code /verify} and {@code /sync} — mirrors the legacy {@code {"error": "..."}} JSON. */
    public record AppleErrorResponse(String error) {}

    private final AppleIapService appleIapService;
    private final AppleServerNotificationService notificationService;
    private final AppleSubscriptionStore subscriptionStore;
    private final AppleProductCatalog productCatalog;

    /**
     * Verify a StoreKit 2 purchase and activate the subscription for the authenticated user.
     * On failure the request throws {@link IllegalStateException}/{@link IllegalArgumentException},
     * mapped to the legacy {@code {"error": "..."}} body by the handlers below — so the success
     * response is the typed {@link AppleActivationResult} the native client codegen wants.
     */
    @PostMapping("/verify")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AppleActivationResult> verify(@AuthenticationPrincipal User currentUser,
                                                        @RequestBody AppleVerifyRequest request) {
        return ResponseEntity.ok(appleIapService.verifyAndActivate(currentUser.getId(), request.jws()));
    }

    /** Restore purchases: reconcile every current entitlement the client holds. */
    @PostMapping("/sync")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AppleActivationResult> sync(@AuthenticationPrincipal User currentUser,
                                                      @RequestBody AppleSyncRequest request) {
        AppleActivationResult result = appleIapService.syncEntitlements(currentUser.getId(), request.jws());
        return result != null ? ResponseEntity.ok(result) : ResponseEntity.noContent().build();
    }

    /**
     * App Store Server Notifications V2 — called by Apple, not the client (no JWT). The {@code signedPayload}
     * is a self-contained JWS verified by signature. Returns 400 on signature failure, 200 otherwise (a 200 on
     * non-signature errors avoids Apple retry storms; the error is logged for investigation).
     */
    @PostMapping("/notifications")
    public ResponseEntity<String> notifications(@RequestBody AppleNotificationPayload payload) {
        try {
            notificationService.handle(payload.signedPayload());
            return ResponseEntity.ok("OK");
        } catch (IllegalArgumentException e) {
            // Bad/forged/empty payload — permanent failure, tell Apple not to retry.
            log.warn("[APPLE NOTIFY] Rejected: {}", e.getMessage());
            return ResponseEntity.badRequest().body("Invalid notification");
        } catch (Exception e) {
            // Infrastructure failure (e.g. DB down): return 500 so Apple retries (up to 72h) rather than
            // silently dropping a renewal/refund/expiry event.
            log.error("[APPLE NOTIFY] Unexpected error processing notification", e);
            return ResponseEntity.internalServerError().body("Retry");
        }
    }

    /** Returns the user's stable appAccountToken for the client to attach at purchase time. */
    @GetMapping("/account-token")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AppleAccountTokenResponse> accountToken(@AuthenticationPrincipal User currentUser) {
        UUID token = subscriptionStore.getOrCreateAppAccountToken(currentUser.getId());
        return ResponseEntity.ok(new AppleAccountTokenResponse(token.toString()));
    }

    /** Active product catalog for building the iOS paywall. */
    @GetMapping("/products")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<AppleProductResponse>> products() {
        List<AppleProductResponse> products = productCatalog.activeProducts().stream()
                .map(p -> new AppleProductResponse(p.productId(), p.planCode(), p.durationMonths()))
                .toList();
        return ResponseEntity.ok(products);
    }

    // ── Failure mapping for /verify and /sync ──────────────────────────────────────────────────
    // Reproduces the exact bodies/status the old inline try/catch returned, so the success path
    // stays typed as AppleActivationResult. Controller-scoped: /notifications catches its own
    // exceptions, so these never intercept it.

    /** Provider not configured / unavailable → 503 {@code {"error": "..."}}. */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<AppleErrorResponse> onProviderUnavailable(IllegalStateException e) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(new AppleErrorResponse(e.getMessage()));
    }

    /** Invalid / forged / cross-account transaction → 400 {@code {"error": "..."}}. */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<AppleErrorResponse> onBadTransaction(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(new AppleErrorResponse(e.getMessage()));
    }
}
