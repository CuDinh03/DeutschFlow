package com.deutschflow.common.security;

import com.deutschflow.user.entity.User;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Date;
import java.util.List;

/**
 * JWT ký và verify token.
 *
 * <p><b>Multi-key + multi-algorithm verify</b> để xoay khóa/đổi thuật toán không gây outage:
 * verify list chứa cả khóa HS256 (primary + previous) lẫn RSA public key (current + previous), nên
 * token ký bằng bất kỳ khóa nào trong đó đều được chấp nhận.
 *
 * <p><b>HS256 → RS256 migration (S18):</b> mặc định {@code app.jwt.algorithm=HS256} (ký HS256) nhưng
 * vẫn verify được RS256 nếu {@code app.jwt.rsa-public-key} được cấu hình. Bật
 * {@code app.jwt.algorithm=RS256} (cần {@code rsa-private-key} + {@code rsa-public-key}) để ký RS256 —
 * lúc đó frontend chỉ cần public key, không còn chia sẻ secret ký. Xem docs/security/RS256_MIGRATION_PLAN.md.
 *
 * <p>Token mới gắn claim {@code iss}/{@code aud}; bật {@code app.jwt.require-iss-aud=true} sau khi token
 * cũ (không có iss/aud) đã hết hạn.
 */
@Slf4j
@Service
public class JwtService {

    /** Khóa dùng để ký token mới — SecretKey (HS256) hoặc RSA PrivateKey (RS256). */
    private final Key signingKey;
    private final String signingAlgorithm;

    /** Khóa dùng khi verify: HS256 secret(s) + RSA public key(s). Token ký bằng bất kỳ khóa nào đều ok. */
    private final List<Key> verifyKeys;

    private final long accessTokenExpiryMs;
    private final String issuer;
    private final String audience;
    private final boolean requireIssAud;

    public JwtService(
            @Value("${app.jwt.secret}") String primary,
            @Value("${app.jwt.secret-previous:}") String previous,
            @Value("${app.jwt.access-token-expiry-ms}") long accessTokenExpiryMs,
            @Value("${app.jwt.issuer:deutschflow-api}") String issuer,
            @Value("${app.jwt.audience:deutschflow-app}") String audience,
            @Value("${app.jwt.require-iss-aud:false}") boolean requireIssAud,
            @Value("${app.jwt.algorithm:HS256}") String algorithm,
            @Value("${app.jwt.rsa-private-key:}") String rsaPrivateKeyPem,
            @Value("${app.jwt.rsa-public-key:}") String rsaPublicKeyPem,
            @Value("${app.jwt.rsa-public-key-previous:}") String rsaPublicKeyPreviousPem) {

        // Algorithm decides whether the HS256 secret is required. Default HS256 (non-breaking).
        String alg = (algorithm == null ? "HS256" : algorithm.trim().toUpperCase());
        boolean hasHsSecret = primary != null && !primary.isBlank();

        if (hasHsSecret && primary.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT secret must be at least 32 bytes.");
        }
        if (!hasHsSecret && !"RS256".equals(alg)) {
            throw new IllegalStateException(
                    "JWT secret is missing. Set JWT_SECRET, or use app.jwt.algorithm=RS256 with RSA keys.");
        }

        this.verifyKeys = new ArrayList<>();

        // HS256 secret(s) → verify list, only if configured. Dropping JWT_SECRET after the RS256
        // cutover removes HS256 verification entirely, closing the symmetric-key forgery path (C2).
        SecretKey hsKey = null;
        if (hasHsSecret) {
            hsKey = Keys.hmacShaKeyFor(primary.getBytes(StandardCharsets.UTF_8));
            this.verifyKeys.add(hsKey);
        }
        if (previous != null && !previous.isBlank()
                && previous.getBytes(StandardCharsets.UTF_8).length >= 32) {
            this.verifyKeys.add(Keys.hmacShaKeyFor(previous.getBytes(StandardCharsets.UTF_8)));
            log.info("[JwtService] Previous HS256 secret loaded — zero-downtime key rotation enabled.");
        }

        // RSA public key(s) → verify list, so RS256 tokens are accepted.
        PublicKey rsaPublic = parseRsaPublicKey(rsaPublicKeyPem);
        if (rsaPublic != null) {
            this.verifyKeys.add(rsaPublic);
            log.info("[JwtService] RSA public key loaded — RS256 tokens will be verified.");
        }
        PublicKey rsaPublicPrev = parseRsaPublicKey(rsaPublicKeyPreviousPem);
        if (rsaPublicPrev != null) {
            this.verifyKeys.add(rsaPublicPrev);
            log.info("[JwtService] Previous RSA public key loaded — RS256 key rotation enabled.");
        }

        // Choose the signer.
        if ("RS256".equals(alg)) {
            Key priv = parseRsaPrivateKey(rsaPrivateKeyPem);
            if (priv == null) {
                throw new IllegalStateException("app.jwt.algorithm=RS256 requires app.jwt.rsa-private-key.");
            }
            if (rsaPublic == null) {
                throw new IllegalStateException("app.jwt.algorithm=RS256 requires app.jwt.rsa-public-key (for verification).");
            }
            this.signingKey = priv;
            this.signingAlgorithm = "RS256";
        } else {
            this.signingKey = hsKey;   // non-null: a blank HS secret under HS256 already threw above
            this.signingAlgorithm = "HS256";
        }

        if (this.verifyKeys.isEmpty()) {
            throw new IllegalStateException("No JWT verification key configured (need JWT_SECRET or an RSA public key).");
        }

        this.accessTokenExpiryMs = accessTokenExpiryMs;
        this.issuer        = issuer;
        this.audience      = audience;
        this.requireIssAud = requireIssAud;

        log.info("[JwtService] Initialized — signing: {}, verify keys: {}, TTL: {}min, issuer: {}, audience: {}, requireIssAud: {}",
                signingAlgorithm, verifyKeys.size(), accessTokenExpiryMs / 60_000, issuer, audience, requireIssAud);
    }

    public String generateAccessToken(User user) {
        long now = System.currentTimeMillis();
        long expiryTime = now + accessTokenExpiryMs;
        String token = Jwts.builder()
                .subject(user.getEmail())
                .claim("role", user.getRole().name())
                .claim("userId", user.getId())
                .issuer(issuer)
                .audience().add(audience).and()
                .issuedAt(new Date(now))
                .expiration(new Date(expiryTime))
                .signWith(signingKey)
                .compact();
        // DEBUG + no PII (email) — token issuance is high-volume; avoid emails in logs.
        log.debug("[JwtService.generateAccessToken] Generated for userId={}, role={}, ttl={}ms",
                user.getId(), user.getRole().name(), accessTokenExpiryMs);
        return token;
    }

    /** Guest token cho quiz — TTL tính bằng ms. */
    public String generateGuestToken(String nickname, String pinCode, long ttlMs) {
        return Jwts.builder()
                .subject("guest:" + nickname)
                .claim("role", "GUEST")
                .claim("pinCode", pinCode)
                .issuer(issuer)
                .audience().add(audience).and()
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + ttlMs))
                .signWith(signingKey)
                .compact();
    }

    /**
     * Verify token và trả về claims.
     *
     * <p>Thử từng key trong {@link #verifyKeys} (HS256 + RSA public). Sai chữ ký
     * ({@link SignatureException}) → thử key tiếp theo. Lỗi khác (hết hạn, malformed, …) ném ngay.
     *
     * <p>Khi {@code app.jwt.require-iss-aud=true}: bắt buộc kiểm tra issuer.
     */
    public Claims extractClaims(String token) {
        JwtException last = null;
        for (Key key : verifyKeys) {
            try {
                JwtParserBuilder pb = Jwts.parser();
                // verifyWith has distinct SecretKey / PublicKey overloads — pick the right one.
                pb = (key instanceof SecretKey sk) ? pb.verifyWith(sk) : pb.verifyWith((PublicKey) key);
                if (requireIssAud) {
                    pb = pb.requireIssuer(issuer);
                    // aud là Set — dùng require() trực tiếp
                }
                return pb.build()
                        .parseSignedClaims(token)
                        .getPayload();
            } catch (SignatureException | UnsupportedJwtException e) {
                // Wrong key, OR a key whose type can't verify this token's algorithm (e.g. an HS256
                // SecretKey tried against an RS256 token throws UnsupportedJwtException) — try next key.
                last = e;
            }
            // ExpiredJwtException, MalformedJwtException, ... → ném ra ngay (không thử key khác)
        }
        throw last != null ? last : new JwtException("No valid key found for token");
    }

    public String extractEmail(String token) {
        return extractClaims(token).getSubject();
    }

    public boolean isTokenValid(String token) {
        try {
            long beforeMs = System.currentTimeMillis();
            Claims claims = extractClaims(token);

            String email = claims.getSubject();
            Date exp  = claims.getExpiration();
            Date iat  = claims.getIssuedAt();
            String role = claims.get("role", String.class);

            log.debug("[JwtService.isTokenValid] ✓ Token is VALID — email: {}, role: {}, iat: {}, exp: {}, now: {}",
                email, role, iat, exp, new Date(beforeMs));

            if (exp != null && exp.before(new Date())) {
                log.warn("[JwtService.isTokenValid] ⚠️ Token expiration is in the PAST: exp={}, now={}", exp, new Date());
            }
            return true;
        } catch (ExpiredJwtException e) {
            log.warn("[JwtService.isTokenValid] ⚠️ TOKEN EXPIRED — exp: {}, now: {}",
                e.getClaims().getExpiration(), new Date());
            return false;
        } catch (SignatureException e) {
            log.warn("[JwtService.isTokenValid] ⚠️ SIGNATURE VERIFICATION FAILED — {}", e.getMessage());
            return false;
        } catch (MalformedJwtException e) {
            log.warn("[JwtService.isTokenValid] ⚠️ MALFORMED JWT — {}", e.getMessage());
            return false;
        } catch (UnsupportedJwtException e) {
            log.warn("[JwtService.isTokenValid] ⚠️ UNSUPPORTED JWT — {}", e.getMessage());
            return false;
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("[JwtService.isTokenValid] ⚠️ JWT VALIDATION ERROR — {}: {}",
                e.getClass().getSimpleName(), e.getMessage());
            return false;
        }
    }

    // ─── RSA PEM parsing (env stores \n-escaped PEM) ──────────────────────────

    private static PublicKey parseRsaPublicKey(String pem) {
        byte[] der = pemToDer(pem);
        if (der == null) return null;
        try {
            return KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(der));
        } catch (Exception e) {
            throw new IllegalStateException("Invalid RSA public key (app.jwt.rsa-public-key*): " + e.getMessage(), e);
        }
    }

    private static java.security.PrivateKey parseRsaPrivateKey(String pem) {
        byte[] der = pemToDer(pem);
        if (der == null) return null;
        try {
            return KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(der));
        } catch (Exception e) {
            throw new IllegalStateException("Invalid RSA private key (app.jwt.rsa-private-key): " + e.getMessage(), e);
        }
    }

    /** Strip PEM armor + whitespace and base64-decode. Tolerates \n-escaped env values. Returns null if blank. */
    private static byte[] pemToDer(String pem) {
        if (pem == null || pem.isBlank()) return null;
        String body = pem
                .replace("\\n", "\n")               // un-escape \n-escaped env values
                .replaceAll("-----BEGIN [^-]+-----", "")
                .replaceAll("-----END [^-]+-----", "")
                .replaceAll("\\s", "");
        return Base64.getDecoder().decode(body);
    }
}
