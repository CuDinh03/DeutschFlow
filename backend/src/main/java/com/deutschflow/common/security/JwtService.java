package com.deutschflow.common.security;

import com.deutschflow.user.entity.User;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
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
import java.util.Set;
import java.util.UUID;

/**
 * JWT ký và verify token.
 *
 * <p><b>Multi-key + multi-algorithm verify</b> để xoay khóa/đổi thuật toán không gây outage:
 * khi ký HS256, verify list chứa khóa HS256 (primary + previous) lẫn RSA public key (current + previous).
 * Khi ký RS256, verify list CHỈ có RSA public key — secret HS256 còn sót bị bỏ qua (audit 28/10 #1).
 *
 * <p><b>HS256 → RS256 migration (S18):</b> mặc định {@code app.jwt.algorithm=HS256} (ký HS256) nhưng
 * vẫn verify được RS256 nếu {@code app.jwt.rsa-public-key} được cấu hình. Bật
 * {@code app.jwt.algorithm=RS256} (cần {@code rsa-private-key} + {@code rsa-public-key}) để ký RS256 —
 * lúc đó frontend chỉ cần public key, không còn chia sẻ secret ký. Xem docs/security/RS256_MIGRATION_PLAN.md.
 *
 * <p>Token mới gắn claim {@code iss}/{@code aud}; bật {@code app.jwt.require-iss-aud=true} sau khi token
 * cũ (không có iss/aud) đã hết hạn.
 *
 * <p><b>Phân loại token (claim {@code typ}, 09/11/2026):</b> mọi token phát hành từ đây mang {@code typ}
 * ({@value #TYP_ACCESS} / {@value #TYP_GUEST} / {@value #TYP_MFA}; {@value #TYP_SUPPORT} cho phiên hỗ
 * trợ chỉ-đọc) và một {@code jti} ngẫu nhiên. {@link JwtAuthFilter} chỉ nhận loại được phép làm
 * access token. Token cũ đã phát hành trên production KHÔNG có {@code typ} — {@link #tokenType(Claims)}
 * coi thiếu {@code typ} là {@value #TYP_ACCESS} nên chúng vẫn chạy tới khi hết hạn.
 */
@Slf4j
@Service
public class JwtService {

    /** Tên claim phân loại token. Thiếu claim = {@link #TYP_ACCESS} (token phát hành trước 09/11/2026). */
    public static final String CLAIM_TYP = "typ";
    /** Access token của người dùng đã đăng ký. */
    public static final String TYP_ACCESS = "access";
    /** Token khách cho quiz ({@code sub = "guest:<nickname>"}). */
    public static final String TYP_GUEST = "guest";
    /** Token thử thách 2FA giữa bước mật khẩu và bước mã — KHÔNG BAO GIỜ là access token. */
    public static final String TYP_MFA = "mfa";
    /**
     * Phiên hỗ trợ chỉ-đọc: ADMIN xem ứng dụng dưới danh tính người dùng đích ({@code sub}). Nhận khi bật
     * {@code app.security.support-session.enabled} và phiên còn mở trong DB — xem {@link #generateSupportToken}.
     */
    public static final String TYP_SUPPORT = "support";
    /** Claim của token support: id dòng {@code admin_support_sessions}. */
    public static final String CLAIM_SUPPORT_SESSION = "sup";
    /** Claim của token support: id ADMIN thực hiện (actor). */
    public static final String CLAIM_ACTOR = "act";
    /** Trần tuổi một token support (30 phút) — không có refresh token. */
    public static final long SUPPORT_TOKEN_MAX_TTL_MS = 30L * 60_000L;
    /** Tiền tố subject của token thử thách 2FA: {@code "mfa:" + userId}. */
    public static final String MFA_SUBJECT_PREFIX = "mfa:";
    /** Claim boolean trên access token: phiên đã qua bước 2FA. */
    public static final String CLAIM_MFA = "mfa";
    /** Claim giây epoch: thời điểm qua bước 2FA (giữ nguyên qua refresh, không phải lúc phát token). */
    public static final String CLAIM_MFA_AT = "mfa_at";
    /** TTL mặc định của token thử thách 2FA ({@code app.jwt.mfa-token-expiry-ms}). */
    static final long DEFAULT_MFA_TOKEN_EXPIRY_MS = 300_000L;

    /** Khóa dùng để ký token mới — SecretKey (HS256) hoặc RSA PrivateKey (RS256). */
    private final Key signingKey;
    private final String signingAlgorithm;

    /** Khóa dùng khi verify: RSA public key(s), cộng HS256 secret(s) chỉ khi ký HS256. */
    private final List<Key> verifyKeys;

    private final long accessTokenExpiryMs;
    private final long mfaTokenExpiryMs;
    private final String issuer;
    private final String audience;
    private final boolean requireIssAud;

    /** Giữ chữ ký cũ cho test/caller dựng tay — TTL token 2FA lấy mặc định 5 phút. */
    public JwtService(String primary, String previous, long accessTokenExpiryMs,
                      String issuer, String audience, boolean requireIssAud,
                      String algorithm, String rsaPrivateKeyPem, String rsaPublicKeyPem,
                      String rsaPublicKeyPreviousPem) {
        this(primary, previous, accessTokenExpiryMs, issuer, audience, requireIssAud, algorithm,
                rsaPrivateKeyPem, rsaPublicKeyPem, rsaPublicKeyPreviousPem, DEFAULT_MFA_TOKEN_EXPIRY_MS);
    }

    @Autowired
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
            @Value("${app.jwt.rsa-public-key-previous:}") String rsaPublicKeyPreviousPem,
            @Value("${app.jwt.mfa-token-expiry-ms:300000}") long mfaTokenExpiryMs) {

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

        // HS256 secret(s) → verify list, only while signing HS256. Under RS256 a leftover JWT_SECRET
        // (or one still shared with the web edge) must NOT verify: anyone holding it could mint a
        // token for any account (audit 28/10 #1). Old HS256 access tokens (≤15 min) then fail and the
        // client refreshes; rolling back to HS256 restores HS verification.
        SecretKey hsKey = null;
        boolean hsVerify = !"RS256".equals(alg);
        if (hasHsSecret) {
            hsKey = Keys.hmacShaKeyFor(primary.getBytes(StandardCharsets.UTF_8));
            if (hsVerify) {
                this.verifyKeys.add(hsKey);
            }
        }
        boolean hasPrevious = previous != null && !previous.isBlank()
                && previous.getBytes(StandardCharsets.UTF_8).length >= 32;
        if (hasPrevious && hsVerify) {
            this.verifyKeys.add(Keys.hmacShaKeyFor(previous.getBytes(StandardCharsets.UTF_8)));
            log.info("[JwtService] Previous HS256 secret loaded — zero-downtime key rotation enabled.");
        }
        if (!hsVerify && (hasHsSecret || hasPrevious)) {
            log.warn("[JwtService] JWT_SECRET/JWT_SECRET_PREVIOUS set under RS256 — IGNORED for verification. Remove them from backend.env and the web edge.");
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
        this.mfaTokenExpiryMs = mfaTokenExpiryMs;
        this.issuer        = issuer;
        this.audience      = audience;
        this.requireIssAud = requireIssAud;

        log.info("[JwtService] Initialized — signing: {}, verify keys: {}, TTL: {}min, issuer: {}, audience: {}, requireIssAud: {}",
                signingAlgorithm, verifyKeys.size(), accessTokenExpiryMs / 60_000, issuer, audience, requireIssAud);
    }

    public String generateAccessToken(User user) {
        return generateAccessToken(user, null, null);
    }

    /**
     * Token có thêm claim org context cho frontend (routing/UI gate /org/*).
     * {@code orgId}/{@code orgRole} chỉ được thêm khi non-null — user B2C không có org thì token y như cũ.
     * Backend authz vẫn verify {@code org_members} trong DB (xem OrgGuard), KHÔNG tin claim này.
     */
    public String generateAccessToken(User user, Long orgId, String orgRole) {
        return generateAccessToken(user, orgId, orgRole, null);
    }

    /**
     * Như {@link #generateAccessToken(User, Long, String)}, thêm dấu 2FA khi {@code mfaVerifiedAt} khác null:
     * {@code mfa=true} và {@code mfa_at} (giây epoch của lần qua 2FA). {@link JwtAuthFilter} đòi
     * {@code mfa=true} trên mọi access token của ADMIN khi {@code app.security.admin-mfa.enforced=true}.
     */
    public String generateAccessToken(User user, Long orgId, String orgRole, java.time.Instant mfaVerifiedAt) {
        long now = System.currentTimeMillis();
        long expiryTime = now + accessTokenExpiryMs;
        JwtBuilder builder = Jwts.builder()
                .id(newJti())
                .subject(user.getEmail())
                .claim(CLAIM_TYP, TYP_ACCESS)
                .claim("role", user.getRole().name())
                .claim("userId", user.getId())
                .issuer(issuer)
                .audience().add(audience).and()
                .issuedAt(new Date(now))
                .expiration(new Date(expiryTime));
        if (orgId != null) {
            builder.claim("orgId", orgId);
        }
        if (orgRole != null) {
            // orgRole is a display hint for frontend routing only; backend never trusts it.
            // After an org-role change the claim stays stale for up to the JWT TTL (~15 min).
            // This is accepted behaviour (C): OrgGuard always re-verifies against org_members in DB.
            builder.claim("orgRole", orgRole); // OWNER | MANAGER | TEACHER | STUDENT
        }
        if (mfaVerifiedAt != null) {
            builder.claim(CLAIM_MFA, true);
            builder.claim(CLAIM_MFA_AT, mfaVerifiedAt.getEpochSecond());
        }
        String token = builder.signWith(signingKey).compact();
        // DEBUG + no PII (email) — token issuance is high-volume; avoid emails in logs.
        log.debug("[JwtService.generateAccessToken] Generated for userId={}, role={}, orgId={}, orgRole={}, ttl={}ms",
                user.getId(), user.getRole().name(), orgId, orgRole, accessTokenExpiryMs);
        return token;
    }

    /** Guest token cho quiz — TTL tính bằng ms. */
    public String generateGuestToken(String nickname, String pinCode, long ttlMs) {
        return Jwts.builder()
                .id(newJti())
                .subject("guest:" + nickname)
                .claim(CLAIM_TYP, TYP_GUEST)
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
     * Token phiên hỗ trợ chỉ-đọc: claim y như access token của người dùng đích ({@code sub}, {@code userId},
     * {@code role}, {@code orgId}/{@code orgRole}) để web định tuyến đúng khu vực, cộng {@code typ=support},
     * {@code sup} (id phiên), {@code act} (id ADMIN) và {@code jti}. {@code exp = min(now + 30 phút,
     * sessionExpiresAt)}. KHÔNG có refresh token và KHÔNG có dấu 2FA ({@code mfa}).
     */
    public String generateSupportToken(User target, Long orgId, String orgRole,
                                       long adminUserId, long sessionId, java.time.Instant sessionExpiresAt) {
        long now = System.currentTimeMillis();
        long exp = now + SUPPORT_TOKEN_MAX_TTL_MS;
        if (sessionExpiresAt != null) {
            exp = Math.min(exp, sessionExpiresAt.toEpochMilli());
        }
        JwtBuilder builder = Jwts.builder()
                .id(newJti())
                .subject(target.getEmail())
                .claim(CLAIM_TYP, TYP_SUPPORT)
                .claim("role", target.getRole().name())
                .claim("userId", target.getId())
                .claim(CLAIM_SUPPORT_SESSION, sessionId)
                .claim(CLAIM_ACTOR, adminUserId)
                .issuer(issuer)
                .audience().add(audience).and()
                .issuedAt(new Date(now))
                .expiration(new Date(exp));
        if (orgId != null) {
            builder.claim("orgId", orgId);
        }
        if (orgRole != null) {
            builder.claim("orgRole", orgRole);
        }
        log.debug("[JwtService.generateSupportToken] session={} admin={} target={}", sessionId, adminUserId, target.getId());
        return builder.signWith(signingKey).compact();
    }

    /** Đọc một claim số (Long/Integer/chuỗi số) — {@code null} khi thiếu hoặc sai kiểu. */
    public static Long longClaim(Claims claims, String name) {
        Object raw = claims == null ? null : claims.get(name);
        if (raw instanceof Number n) {
            return n.longValue();
        }
        if (raw == null) {
            return null;
        }
        try {
            return Long.parseLong(String.valueOf(raw).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * Token thử thách 2FA: chứng minh người dùng đã qua bước mật khẩu, CHƯA qua bước mã.
     * {@code typ=mfa}, {@code sub="mfa:"+userId}, KHÔNG có {@code role}/{@code userId}, TTL
     * {@code app.jwt.mfa-token-expiry-ms} (mặc định 5 phút). {@link JwtAuthFilter} từ chối nó (401) nếu
     * bị trình như access token; endpoint xác minh mã 2FA (PR sau) sẽ đọc nó qua {@link #extractClaims}.
     */
    public String generateMfaChallengeToken(long userId) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .id(newJti())
                .subject(MFA_SUBJECT_PREFIX + userId)
                .claim(CLAIM_TYP, TYP_MFA)
                .issuer(issuer)
                .audience().add(audience).and()
                .issuedAt(new Date(now))
                .expiration(new Date(now + mfaTokenExpiryMs))
                .signWith(signingKey)
                .compact();
    }

    /**
     * Loại token đã verify. Thiếu claim {@code typ} (hoặc rỗng) → {@value #TYP_ACCESS}: token phát
     * hành trước khi có claim này vẫn là access/guest token hợp lệ tới khi hết hạn.
     */
    public static String tokenType(Claims claims) {
        Object raw = claims == null ? null : claims.get(CLAIM_TYP);
        if (raw == null) {
            return TYP_ACCESS;
        }
        String typ = String.valueOf(raw).trim();
        return typ.isEmpty() ? TYP_ACCESS : typ;
    }

    /** {@code true} khi access token mang dấu đã qua 2FA ({@code mfa=true}). */
    public static boolean hasMfa(Claims claims) {
        if (claims == null) {
            return false;
        }
        Object raw = claims.get(CLAIM_MFA);
        return raw instanceof Boolean b ? b : "true".equalsIgnoreCase(String.valueOf(raw));
    }

    /** Thời điểm qua 2FA ghi trong token ({@code mfa_at}); {@code null} khi token không có dấu 2FA. */
    public static java.time.Instant mfaVerifiedAt(Claims claims) {
        if (!hasMfa(claims)) {
            return null;
        }
        Object raw = claims.get(CLAIM_MFA_AT);
        if (raw instanceof Number n) {
            return java.time.Instant.ofEpochSecond(n.longValue());
        }
        try {
            return raw == null ? null : java.time.Instant.ofEpochSecond(Long.parseLong(String.valueOf(raw)));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** {@code true} khi token không mang claim {@code typ} (phát hành trước 09/11/2026). */
    public static boolean isLegacyUntyped(Claims claims) {
        Object raw = claims == null ? null : claims.get(CLAIM_TYP);
        return raw == null || String.valueOf(raw).isBlank();
    }

    private static String newJti() {
        return UUID.randomUUID().toString();
    }

    /**
     * Verify token và trả về claims.
     *
     * <p>Thử từng key trong {@link #verifyKeys} (HS256 + RSA public). Sai chữ ký
     * ({@link SignatureException}) → thử key tiếp theo. Lỗi khác (hết hạn, malformed, …) ném ngay.
     *
     * <p>Khi {@code app.jwt.require-iss-aud=true}: bắt buộc kiểm tra CẢ issuer LẪN audience.
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
                }
                Claims claims = pb.build()
                        .parseSignedClaims(token)
                        .getPayload();
                if (requireIssAud) {
                    // Audit R-M10 (03/09/2026): trước đây chỉ requireIssuer — claim aud được GẮN lúc
                    // phát hành nhưng KHÔNG BAO GIỜ kiểm lúc verify, nên require-iss-aud=true hứa
                    // nhiều hơn code làm. jjwt 0.12 để aud là Set, require() scalar không dùng được,
                    // nên kiểm chứa thủ công. Chữ ký đã đúng ở đây → sai audience là ném NGAY (không
                    // phải SignatureException nên không rơi vào nhánh thử-key-tiếp-theo).
                    Set<String> aud = claims.getAudience();
                    if (aud == null || !aud.contains(audience)) {
                        throw new JwtException("JWT audience không hợp lệ");
                    }
                }
                return claims;
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
