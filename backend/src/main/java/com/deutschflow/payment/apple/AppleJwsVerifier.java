package com.deutschflow.payment.apple;

import com.apple.itunes.storekit.model.Environment;
import com.apple.itunes.storekit.model.JWSTransactionDecodedPayload;
import com.apple.itunes.storekit.model.ResponseBodyV2DecodedPayload;
import com.apple.itunes.storekit.verification.SignedDataVerifier;
import com.apple.itunes.storekit.verification.VerificationException;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

/**
 * Verifies and decodes Apple-signed data (StoreKit 2 transactions and App Store Server Notifications V2)
 * using Apple's official {@code app-store-server-library}. Signature is validated locally against the
 * Apple Root CA certificate chain — no network round-trip, no shared secret.
 *
 * <p>Disabled gracefully (logs a warning, {@link #isEnabled()} returns false) when the root certificates
 * or bundle id are not configured, mirroring how Stripe degrades when its secret is absent. Configure via:
 * <ul>
 *   <li>{@code payment.apple.bundle-id} (default {@code com.deutschflow.app})</li>
 *   <li>{@code payment.apple.app-apple-id} (numeric App Store id, required for PRODUCTION verification)</li>
 *   <li>{@code payment.apple.environment} (Sandbox | Production | LocalTesting | Xcode)</li>
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

    @Value("${payment.apple.environment:Sandbox}")
    private String environmentRaw;

    @Value("${payment.apple.root-cert-dir:}")
    private String rootCertDir;

    @Value("${payment.apple.online-checks:false}")
    private boolean onlineChecks;

    private SignedDataVerifier verifier;
    private Environment environment;

    @PostConstruct
    void init() {
        if (rootCertDir == null || rootCertDir.isBlank()) {
            log.warn("[APPLE] payment.apple.root-cert-dir is not configured — Apple IAP verification is disabled.");
            return;
        }
        Set<InputStream> rootCerts = loadRootCertificates(rootCertDir);
        if (rootCerts.isEmpty()) {
            log.warn("[APPLE] No Apple Root CA certificates found in {} — Apple IAP verification is disabled.", rootCertDir);
            return;
        }

        this.environment = parseEnvironment(environmentRaw);
        Long appAppleId = parseAppAppleId(appAppleIdRaw);
        if (environment == Environment.PRODUCTION && appAppleId == null) {
            log.warn("[APPLE] environment=Production requires payment.apple.app-apple-id — Apple IAP verification is disabled.");
            return;
        }

        try {
            this.verifier = new SignedDataVerifier(rootCerts, bundleId, appAppleId, environment, onlineChecks);
            log.info("[APPLE] SignedDataVerifier initialized. bundleId={} environment={} onlineChecks={}",
                    bundleId, environment, onlineChecks);
        } catch (Exception e) {
            log.error("[APPLE] Failed to initialize SignedDataVerifier — Apple IAP verification is disabled.", e);
            this.verifier = null;
        }
    }

    public boolean isEnabled() {
        return verifier != null;
    }

    /** Verify and decode a StoreKit 2 signed transaction (JWS). */
    public JWSTransactionDecodedPayload verifyTransaction(String signedTransaction) throws VerificationException {
        return requireVerifier().verifyAndDecodeTransaction(signedTransaction);
    }

    /** Verify and decode an App Store Server Notification V2 signed payload. */
    public ResponseBodyV2DecodedPayload verifyNotification(String signedPayload) throws VerificationException {
        return requireVerifier().verifyAndDecodeNotification(signedPayload);
    }

    private SignedDataVerifier requireVerifier() {
        if (verifier == null) {
            throw new IllegalStateException("Apple IAP is not configured on this server.");
        }
        return verifier;
    }

    private static Set<InputStream> loadRootCertificates(String dir) {
        Set<InputStream> certs = new LinkedHashSet<>();
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
                // Read fully into memory so the stream is self-contained and no file handle leaks.
                certs.add(new ByteArrayInputStream(Files.readAllBytes(f)));
                log.info("[APPLE] Loaded Apple root certificate: {}", f.getFileName());
            }
        } catch (Exception e) {
            log.error("[APPLE] Failed to read Apple root certificates from {}", dir, e);
        }
        return certs;
    }

    private static Environment parseEnvironment(String raw) {
        if (raw == null || raw.isBlank()) {
            return Environment.SANDBOX;
        }
        try {
            // Accept both Apple's wire value ("Sandbox") and the enum name ("SANDBOX").
            return Environment.fromValue(raw);
        } catch (Exception ignored) {
            try {
                return Environment.valueOf(raw.toUpperCase());
            } catch (Exception ignored2) {
                log.warn("[APPLE] Unknown environment '{}', defaulting to Sandbox", raw);
                return Environment.SANDBOX;
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
