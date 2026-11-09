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

    @Test
    void rs256OnlyVerifiesRsButRejectsHs() throws Exception {
        KeyPair kp = rsaKeyPair();
        // Final state (C2): RS256-only, NO HS secret configured.
        JwtService rsOnly = new JwtService("", "", 3_600_000L,
                                            "deutschflow-api", "deutschflow-app", false,
                                            "RS256", pkcs8Pem(kp), x509Pem(kp), "");
        String rsToken = rsOnly.generateAccessToken(student());
        assertTrue(rsOnly.isTokenValid(rsToken), "RS256 token must verify under RS256-only");
        assertEquals("a@b.com", rsOnly.extractEmail(rsToken));

        // Once JWT_SECRET is dropped, HS256 tokens must NOT verify — the symmetric forgery path is closed.
        JwtService hsSigner = new JwtService(SECRET_32_PLUS, "", 3_600_000L,
                                              "deutschflow-api", "deutschflow-app", false,
                                              "HS256", "", "", "");
        String hsToken = hsSigner.generateAccessToken(student());
        assertFalse(rsOnly.isTokenValid(hsToken), "HS256 token must be rejected once HS256 is dropped");
    }

    @Test
    void rs256IgnoresLeftoverHsSecretsForVerification() throws Exception {
        // Audit 28/10 #1: RS256 với JWT_SECRET (+ PREVIOUS) còn sót trong env — ai giữ secret đó
        // không được tự ký HS256 cho tài khoản bất kỳ.
        KeyPair kp = rsaKeyPair();
        String previous = SECRET_32_PLUS + "-previous";
        JwtService rsWithLeftover = new JwtService(SECRET_32_PLUS, previous, 3_600_000L,
                                                    "deutschflow-api", "deutschflow-app", false,
                                                    "RS256", pkcs8Pem(kp), x509Pem(kp), "");
        assertTrue(rsWithLeftover.isTokenValid(rsWithLeftover.generateAccessToken(student())),
                "RS256 token vẫn phải hợp lệ");

        for (String secret : new String[] { SECRET_32_PLUS, previous }) {
            JwtService forger = new JwtService(secret, "", 3_600_000L,
                                                "deutschflow-api", "deutschflow-app", false,
                                                "HS256", "", "", "");
            String forged = forger.generateAccessToken(student());
            assertFalse(rsWithLeftover.isTokenValid(forged), "HS256 ký bằng secret sót phải bị từ chối");
        }
    }

    @Test
    void hs256StillRequiresSecret() {
        // Guard: HS256 mode with no secret must still fail fast (regression check).
        assertThrows(IllegalStateException.class, () ->
            new JwtService("", "", 1000, "iss", "aud", false, "HS256", "", "", ""));
    }

    // ── R-M10: require-iss-aud=true phải enforce CẢ issuer LẪN audience ──────────────

    @Test
    void requireIssAud_acceptsMatchingIssuerAndAudience() {
        JwtService jwt = new JwtService(SECRET_32_PLUS, "", 3_600_000L,
                "deutschflow-api", "deutschflow-app", true,
                "HS256", "", "", "");
        String token = jwt.generateAccessToken(student());
        assertTrue(jwt.isTokenValid(token), "token đúng iss+aud phải hợp lệ khi bật require-iss-aud");
        assertEquals("a@b.com", jwt.extractEmail(token));
    }

    @Test
    void requireIssAud_rejectsWrongAudience_evenWithValidSignatureAndIssuer() {
        // Cùng secret (chữ ký verify được) + cùng issuer, chỉ khác AUDIENCE. Trước R-M10, verifier
        // chỉ requireIssuer nên token vẫn lọt dù aud sai — đúng khoảng trống mà tên cấu hình che.
        JwtService issuer = new JwtService(SECRET_32_PLUS, "", 3_600_000L,
                "deutschflow-api", "deutschflow-app", true,
                "HS256", "", "", "");
        JwtService verifierOtherAud = new JwtService(SECRET_32_PLUS, "", 3_600_000L,
                "deutschflow-api", "some-other-service", true,
                "HS256", "", "", "");
        String token = issuer.generateAccessToken(student()); // aud = deutschflow-app

        assertFalse(verifierOtherAud.isTokenValid(token),
                "token mang aud khác phải bị từ chối khi require-iss-aud=true");
        assertThrows(io.jsonwebtoken.JwtException.class,
                () -> verifierOtherAud.extractClaims(token));
    }

    @Test
    void audienceNotEnforced_whenRequireIssAudOff() {
        // Cổng enforce là chính flag: tắt thì audience khác vẫn qua (giữ tương thích ngược trước cutover).
        JwtService issuer = new JwtService(SECRET_32_PLUS, "", 3_600_000L,
                "deutschflow-api", "deutschflow-app", false,
                "HS256", "", "", "");
        JwtService verifierOtherAud = new JwtService(SECRET_32_PLUS, "", 3_600_000L,
                "deutschflow-api", "some-other-service", false,
                "HS256", "", "", "");
        String token = issuer.generateAccessToken(student());

        assertTrue(verifierOtherAud.isTokenValid(token),
                "require-iss-aud=false thì không enforce audience");
    }

    // ── Phân loại token (typ + jti, 09/11/2026) ─────────────────────────────────────

    private static JwtService hs256() {
        return new JwtService(SECRET_32_PLUS, "", 3_600_000L,
                "deutschflow-api", "deutschflow-app", false,
                "HS256", "", "", "");
    }

    @Test
    void accessTokenCarriesTypAccessAndRandomJti() {
        JwtService jwt = hs256();
        io.jsonwebtoken.Claims c1 = jwt.extractClaims(jwt.generateAccessToken(student()));
        io.jsonwebtoken.Claims c2 = jwt.extractClaims(jwt.generateAccessToken(student()));

        assertEquals(JwtService.TYP_ACCESS, c1.get(JwtService.CLAIM_TYP));
        assertEquals(JwtService.TYP_ACCESS, JwtService.tokenType(c1));
        assertFalse(JwtService.isLegacyUntyped(c1));
        assertNotNull(c1.getId(), "jti phải có");
        assertFalse(c1.getId().isBlank());
        assertNotEquals(c1.getId(), c2.getId(), "jti phải ngẫu nhiên mỗi token");
    }

    @Test
    void rs256AccessTokenAlsoTyped() throws Exception {
        KeyPair kp = rsaKeyPair();
        JwtService jwt = new JwtService(SECRET_32_PLUS, "", 3_600_000L,
                "deutschflow-api", "deutschflow-app", false,
                "RS256", pkcs8Pem(kp), x509Pem(kp), "");
        io.jsonwebtoken.Claims c = jwt.extractClaims(jwt.generateAccessToken(student()));
        assertEquals(JwtService.TYP_ACCESS, JwtService.tokenType(c));
        assertNotNull(c.getId());
    }

    @Test
    void guestTokenCarriesTypGuestAndJti() {
        JwtService jwt = hs256();
        io.jsonwebtoken.Claims c = jwt.extractClaims(jwt.generateGuestToken("nick", "123456", 60_000L));

        assertEquals("guest:nick", c.getSubject());
        assertEquals(JwtService.TYP_GUEST, JwtService.tokenType(c));
        assertEquals("123456", c.get("pinCode", String.class));
        assertNotNull(c.getId());
    }

    @Test
    void mfaChallengeTokenShape() {
        JwtService jwt = new JwtService(SECRET_32_PLUS, "", 3_600_000L,
                "deutschflow-api", "deutschflow-app", false,
                "HS256", "", "", "", 120_000L);
        long before = System.currentTimeMillis();
        io.jsonwebtoken.Claims c = jwt.extractClaims(jwt.generateMfaChallengeToken(42L));

        assertEquals("mfa:42", c.getSubject());
        assertEquals(JwtService.TYP_MFA, JwtService.tokenType(c));
        assertNull(c.get("role"), "token 2FA không được mang role");
        assertNull(c.get("userId"), "token 2FA không mang userId (đã nằm trong sub)");
        assertNotNull(c.getId());
        assertEquals("deutschflow-api", c.getIssuer());
        assertTrue(c.getAudience().contains("deutschflow-app"));
        long ttl = c.getExpiration().getTime() - c.getIssuedAt().getTime();
        assertEquals(120_000L, ttl, "TTL lấy từ app.jwt.mfa-token-expiry-ms");
        assertTrue(c.getExpiration().getTime() <= before + 120_000L + 1_000L);
    }

    @Test
    void mfaChallengeTokenDefaultTtlIsFiveMinutes() {
        JwtService jwt = hs256();
        io.jsonwebtoken.Claims c = jwt.extractClaims(jwt.generateMfaChallengeToken(7L));
        assertEquals(300_000L, c.getExpiration().getTime() - c.getIssuedAt().getTime());
    }

    @Test
    void missingTypMeansAccess_legacyProductionTokensStayValid() {
        // Token phát hành TRƯỚC bản này: không typ, không jti — ký bằng cùng secret.
        String legacy = io.jsonwebtoken.Jwts.builder()
                .subject("a@b.com")
                .claim("role", "STUDENT")
                .claim("userId", 9L)
                .issuer("deutschflow-api")
                .issuedAt(new java.util.Date())
                .expiration(new java.util.Date(System.currentTimeMillis() + 60_000L))
                .signWith(io.jsonwebtoken.security.Keys.hmacShaKeyFor(
                        SECRET_32_PLUS.getBytes(java.nio.charset.StandardCharsets.UTF_8)))
                .compact();
        JwtService jwt = hs256();

        assertTrue(jwt.isTokenValid(legacy));
        io.jsonwebtoken.Claims c = jwt.extractClaims(legacy);
        assertEquals(JwtService.TYP_ACCESS, JwtService.tokenType(c));
        assertTrue(JwtService.isLegacyUntyped(c));
    }

    @Test
    void blankTypAlsoMeansAccess() {
        io.jsonwebtoken.Claims c = io.jsonwebtoken.Jwts.claims().add(JwtService.CLAIM_TYP, "  ").build();
        assertEquals(JwtService.TYP_ACCESS, JwtService.tokenType(c));
        assertTrue(JwtService.isLegacyUntyped(c));
    }
}
