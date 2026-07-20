package com.deutschflow.payment.apple;

import com.apple.itunes.storekit.model.Environment;
import com.apple.itunes.storekit.model.JWSTransactionDecodedPayload;
import com.apple.itunes.storekit.model.ResponseBodyV2DecodedPayload;
import com.apple.itunes.storekit.verification.SignedDataVerifier;
import com.apple.itunes.storekit.verification.VerificationException;
import com.apple.itunes.storekit.verification.VerificationStatus;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

/**
 * Verifies and decodes Apple-signed data (StoreKit 2 transactions and App Store Server Notifications V2)
 * using Apple's official {@code app-store-server-library}. Signature is validated locally against the
 * Apple Root CA certificate chain — no network round-trip, no shared secret.
 *
 * <p><b>Dual environment.</b> StoreKit stamps every JWS with the environment it was minted in — real App
 * Store buyers produce {@code Production} payloads, TestFlight and sandbox testers produce {@code Sandbox}
 * ones — and {@link SignedDataVerifier} rejects a payload whose environment differs from the one it was
 * built for with {@link VerificationStatus#INVALID_ENVIRONMENT}. To let a SINGLE backend serve real buyers
 * AND keep TestFlight/review testing working, this verifier builds one {@link SignedDataVerifier} per
 * environment and tries them in priority order (primary = {@code payment.apple.environment}, the other
 * second), treating {@code INVALID_ENVIRONMENT} as "wrong environment, try the next". This is Apple's
 * recommended verify-Production-then-Sandbox pattern. Any OTHER failure (bad signature, wrong bundle id,
 * broken chain) is a real rejection and is rethrown immediately — a fallback attempt never masks it.
 *
 * <p>Disabled gracefully (logs a warning, {@link #isEnabled()} returns false) when the root certificates
 * or bundle id are not configured, mirroring how Stripe degrades when its secret is absent. Configure via:
 * <ul>
 *   <li>{@code payment.apple.bundle-id} (default {@code com.deutschflow.app})</li>
 *   <li>{@code payment.apple.app-apple-id} (numeric App Store id, required for PRODUCTION verification)</li>
 *   <li>{@code payment.apple.environment} (Sandbox | Production | LocalTesting | Xcode) — the PRIMARY environment
 *       to try first; Production/Sandbox auto-fall-back to each other</li>
 *   <li>{@code payment.apple.root-cert-dir} (directory of Apple Root CA {@code *.cer}/{@code *.pem} files)</li>
 *   <li>{@code payment.apple.online-checks} (OCSP revocation checks; default false)</li>
 * </ul>
 */
@Component
@Slf4j
public class AppleJwsVerifier {

    @Value("${payment.apple.bundle-id:com.deutschflow.app}")
    private String bundleId;

    @Value("${payment.apple.app-apple-id:}")
    private String appAppleIdRaw;

    @Value("${payment.apple.environment:Production}")
    private String environmentRaw;

    @Value("${payment.apple.root-cert-dir:}")
    private String rootCertDir;

    @Value("${payment.apple.online-checks:false}")
    private boolean onlineChecks;

    /**
     * Verifiers ordered by attempt priority: the configured (primary) environment first, the other second.
     * {@code volatile} because it is assigned once in {@code @PostConstruct} and then read by request threads —
     * publishing it safely without relying on the servlet-startup happens-before ordering.
     */
    private volatile List<SignedDataVerifier> verifiers = List.of();

    @PostConstruct
    void init() {
        if (rootCertDir == null || rootCertDir.isBlank()) {
            log.warn("[APPLE] payment.apple.root-cert-dir is not configured — Apple IAP verification is disabled.");
            return;
        }
        List<byte[]> rootCerts = loadRootCertificates(rootCertDir);
        if (rootCerts.isEmpty()) {
            log.warn("[APPLE] No Apple Root CA certificates found in {} — Apple IAP verification is disabled.", rootCertDir);
            return;
        }

        Environment primary = parseEnvironment(environmentRaw);
        Long appAppleId = parseAppAppleId(appAppleIdRaw);

        // Build a verifier per environment, primary first. Production requires the numeric app-apple-id;
        // when it is absent we skip Production and fall back to Sandbox-only (still valid for TestFlight/review).
        List<SignedDataVerifier> built = new ArrayList<>();
        List<Environment> builtEnvs = new ArrayList<>();
        for (Environment env : orderedEnvironments(primary)) {
            if (env == Environment.PRODUCTION && appAppleId == null) {
                // The go-live incident was real purchases silently failing verification. If Production can't be
                // built (missing app-apple-id) make it LOUD — a swallowed warning is how that bug recurs.
                log.error("[APPLE] Production verifier NOT built — payment.apple.app-apple-id is required for "
                        + "Production. Real App Store purchases will FAIL verification until this is set.");
                continue;
            }
            try {
                built.add(new SignedDataVerifier(freshStreams(rootCerts), bundleId, appAppleId, env, onlineChecks));
                builtEnvs.add(env);
            } catch (Exception e) {
                log.error("[APPLE] Failed to initialize {} verifier.", env, e);
            }
        }

        if (built.isEmpty()) {
            log.warn("[APPLE] No Apple verifier could be initialized — Apple IAP verification is disabled.");
            return;
        }
        this.verifiers = List.copyOf(built);
        if (!builtEnvs.contains(primary)) {
            // Primary environment failed to build (e.g. Production skipped for missing app-apple-id, or a
            // construction error). We still run degraded on the fallback, but surface it loudly.
            log.error("[APPLE] Primary environment {} could not be initialized — running with {} only. "
                    + "Check payment.apple.* config.", primary, builtEnvs);
        }
        log.info("[APPLE] SignedDataVerifier initialized. bundleId={} environment={} fallbackEnvironments={} onlineChecks={}",
                bundleId, builtEnvs.get(0), builtEnvs.subList(1, builtEnvs.size()), onlineChecks);
    }

    public boolean isEnabled() {
        return !verifiers.isEmpty();
    }

    /** Verify and decode a StoreKit 2 signed transaction (JWS), trying the primary environment then the other. */
    public JWSTransactionDecodedPayload verifyTransaction(String signedTransaction) throws VerificationException {
        return verifyWithEnvironmentFallback(requireVerifiers(), v -> v.verifyAndDecodeTransaction(signedTransaction));
    }

    /** Verify and decode an App Store Server Notification V2 signed payload, trying primary then the other. */
    public ResponseBodyV2DecodedPayload verifyNotification(String signedPayload) throws VerificationException {
        return verifyWithEnvironmentFallback(requireVerifiers(), v -> v.verifyAndDecodeNotification(signedPayload));
    }

    private List<SignedDataVerifier> requireVerifiers() {
        if (verifiers.isEmpty()) {
            throw new IllegalStateException("Apple IAP is not configured on this server.");
        }
        return verifiers;
    }

    /**
     * Run {@code op} against each configured verifier in priority order. A pure environment mismatch
     * ({@link VerificationStatus#INVALID_ENVIRONMENT}) means "wrong environment, try the next"; any OTHER
     * failure (bad signature, wrong bundle id, broken chain) is a real rejection and is rethrown immediately
     * so a genuinely invalid JWS is never masked by a fallback attempt.
     */
    static <T> T verifyWithEnvironmentFallback(List<SignedDataVerifier> verifiers, VerifyOp<T> op)
            throws VerificationException {
        VerificationException envMismatch = null;
        for (SignedDataVerifier v : verifiers) {
            try {
                return op.apply(v);
            } catch (VerificationException e) {
                if (e.getStatus() == VerificationStatus.INVALID_ENVIRONMENT) {
                    envMismatch = e;
                    continue;
                }
                throw e;
            }
        }
        // Every configured environment rejected the JWS as belonging to a different environment.
        throw envMismatch != null ? envMismatch
                : new VerificationException(VerificationStatus.INVALID_ENVIRONMENT);
    }

    /** A verify call against a single {@link SignedDataVerifier}; may throw the library's checked exception. */
    @FunctionalInterface
    interface VerifyOp<T> {
        T apply(SignedDataVerifier verifier) throws VerificationException;
    }

    private static List<Environment> orderedEnvironments(Environment primary) {
        // Only Production/Sandbox carry the real Apple root chain and are the two live environments StoreKit
        // emits. LocalTesting/Xcode are dev-only, so configuring one means "use exactly this" — no auto-pairing.
        if (primary != Environment.PRODUCTION && primary != Environment.SANDBOX) {
            return List.of(primary);
        }
        Environment other = (primary == Environment.PRODUCTION) ? Environment.SANDBOX : Environment.PRODUCTION;
        return List.of(primary, other);
    }

    private static Set<InputStream> freshStreams(List<byte[]> certs) {
        // SignedDataVerifier consumes the streams while building its trust anchors, so every verifier
        // instance needs its OWN fresh streams — reusing consumed streams would silently yield an empty chain.
        Set<InputStream> streams = new LinkedHashSet<>();
        for (byte[] cert : certs) {
            streams.add(new ByteArrayInputStream(cert));
        }
        return streams;
    }

    private static List<byte[]> loadRootCertificates(String dir) {
        List<byte[]> certs = new ArrayList<>();
        Path path = Path.of(dir);
        if (!Files.isDirectory(path)) {
            log.warn("[APPLE] root-cert-dir is not a directory: {}", dir);
            return certs;
        }
        try (Stream<Path> files = Files.list(path)) {
            List<Path> certFiles = files
                    .filter(Files::isRegularFile)
                    .filter(p -> {
                        String name = p.getFileName().toString().toLowerCase();
                        return name.endsWith(".cer") || name.endsWith(".pem") || name.endsWith(".der");
                    })
                    .toList();
            for (Path f : certFiles) {
                // Read fully into memory so each verifier can be given its own stream and no file handle leaks.
                certs.add(Files.readAllBytes(f));
                log.info("[APPLE] Loaded Apple root certificate: {}", f.getFileName());
            }
        } catch (Exception e) {
            log.error("[APPLE] Failed to read Apple root certificates from {}", dir, e);
        }
        return certs;
    }

    private static Environment parseEnvironment(String raw) {
        if (raw == null || raw.isBlank()) {
            return Environment.PRODUCTION;
        }
        try {
            // Accept both Apple's wire value ("Sandbox") and the enum name ("SANDBOX").
            return Environment.fromValue(raw);
        } catch (Exception ignored) {
            try {
                return Environment.valueOf(raw.toUpperCase());
            } catch (Exception ignored2) {
                log.warn("[APPLE] Unknown environment '{}', defaulting to Production", raw);
                return Environment.PRODUCTION;
            }
        }
    }

    private static Long parseAppAppleId(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(raw.trim());
        } catch (NumberFormatException e) {
            log.warn("[APPLE] Invalid payment.apple.app-apple-id '{}' — ignoring.", raw);
            return null;
        }
    }
}
