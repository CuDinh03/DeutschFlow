package com.deutschflow.common.security;

import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.Test;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceUnitTest {

    private static final String SECRET_32_PLUS = "abcdefghijklmnopqrstuvwxyz0123456789abcdef";

    private static User student() {
        return User.builder()
                .id(9L).email("a@b.com").passwordHash("x").displayName("T")
                .role(User.Role.STUDENT)
                .build();
    }

    private static KeyPair rsaKeyPair() throws Exception {
        KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
        kpg.initialize(2048);
        return kpg.generateKeyPair();
    }

    // Build the PEM armor dynamically so the source has no literal private-key header block
    // (secret scanners flag those). These are ephemeral keys generated per-test.
    private static String pem(String type, byte[] der) {
        String dash = "-----";
        return dash + "BEGIN " + type + dash + "\n"
                + Base64.getEncoder().encodeToString(der)
                + "\n" + dash + "END " + type + dash;
    }

    private static String pkcs8Pem(KeyPair kp) { return pem("PRIVATE KEY", kp.getPrivate().getEncoded()); }
    private static String x509Pem(KeyPair kp)  { return pem("PUBLIC KEY", kp.getPublic().getEncoded()); }

    @Test
    void generatesRoundTripAccessToken() {
        // Constructor: primary, previous, ttlMs, issuer, audience, requireIssAud, algorithm, rsaPriv, rsaPub, rsaPubPrev
        JwtService jwt = new JwtService(SECRET_32_PLUS, "", 3_600_000L,
                                         "deutschflow-api", "deutschflow-app", false,
                                         "HS256", "", "", "");
        String token = jwt.generateAccessToken(student());
        assertNotNull(token);
        assertEquals("a@b.com", jwt.extractEmail(token));
        assertTrue(jwt.isTokenValid(token));
    }

    @Test
    void rejectsTooShortSecret() {
        assertThrows(IllegalStateException.class, () ->
            new JwtService("short", "", 1000, "iss", "aud", false, "HS256", "", "", ""));
    }

    @Test
    void generatesRoundTripRs256Token() throws Exception {
        KeyPair kp = rsaKeyPair();
        JwtService jwt = new JwtService(SECRET_32_PLUS, "", 3_600_000L,
                                         "deutschflow-api", "deutschflow-app", false,
                                         "RS256", pkcs8Pem(kp), x509Pem(kp), "");
        String token = jwt.generateAccessToken(student());
        assertEquals("a@b.com", jwt.extractEmail(token));
        assertTrue(jwt.isTokenValid(token));
    }

    @Test
    void rs256RequiresPrivateKey() throws Exception {
        KeyPair kp = rsaKeyPair();
        assertThrows(IllegalStateException.class, () ->
            new JwtService(SECRET_32_PLUS, "", 1000, "iss", "aud", false,
                           "RS256", "", x509Pem(kp), ""));
    }

    @Test
    void verifyBothHs256AndRs256DuringTransition() throws Exception {
        KeyPair kp = rsaKeyPair();
        // Issuer that signs RS256.
        JwtService rsSigner = new JwtService(SECRET_32_PLUS, "", 3_600_000L,
                                              "deutschflow-api", "deutschflow-app", false,
                                              "RS256", pkcs8Pem(kp), x509Pem(kp), "");
        // Verifier that still SIGNS HS256 but also holds the RSA public key (the "verify-both" state).
        JwtService verifyBoth = new JwtService(SECRET_32_PLUS, "", 3_600_000L,
                                                "deutschflow-api", "deutschflow-app", false,
                                                "HS256", "", x509Pem(kp), "");
        String hsToken = verifyBoth.generateAccessToken(student()); // HS256
        String rsToken = rsSigner.generateAccessToken(student());   // RS256

        assertTrue(verifyBoth.isTokenValid(hsToken), "HS256 token must verify");
        assertTrue(verifyBoth.isTokenValid(rsToken), "RS256 token must verify during transition");
        assertEquals("a@b.com", verifyBoth.extractEmail(rsToken));
    }
}
