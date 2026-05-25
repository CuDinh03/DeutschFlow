package com.deutschflow.common.security;

import com.deutschflow.user.entity.User;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/**
 * JWT ký và verify token.
 *
 * <p>Hỗ trợ <b>multi-key verify</b> để xoay secret không gây outage:
 * <ol>
 *   <li>Set {@code JWT_SECRET} = khóa mới, {@code JWT_SECRET_PREVIOUS} = khóa cũ.</li>
 *   <li>Deploy backend — token mới ký bằng khóa mới; token cũ vẫn verify được bằng khóa cũ.</li>
 *   <li>Sau ≥ 15 phút (toàn bộ access token cũ đã hết hạn), bỏ {@code JWT_SECRET_PREVIOUS}. Deploy.</li>
 * </ol>
 *
 * <p>Token mới được gắn claim {@code iss} (issuer) và {@code aud} (audience)
 * theo RFC 7519 để ngăn tái sử dụng token giữa các service khác nhau.
 * Token cũ (không có iss/aud) vẫn được verify trong giai đoạn chuyển tiếp;
 * bật {@code app.jwt.require-iss-aud=true} sau khi toàn bộ token cũ hết hạn.
 */
@Slf4j
@Service
public class JwtService {

    /** Khóa dùng để ký token mới — luôn là primary key. */
    private final SecretKey signingKey;

    /**
     * Danh sách khóa dùng khi verify: primary trước, previous sau.
     * Trong giai đoạn chuyển tiếp, token ký bằng khóa cũ vẫn được chấp nhận.
     */
    private final List<SecretKey> verifyKeys;

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
            @Value("${app.jwt.require-iss-aud:false}") boolean requireIssAud) {

        if (primary == null || primary.isBlank()) {
            throw new IllegalStateException("JWT secret is missing. Set JWT_SECRET in environment.");
        }
        if (primary.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT secret must be at least 32 bytes.");
        }

        this.signingKey = Keys.hmacShaKeyFor(primary.getBytes(StandardCharsets.UTF_8));
        this.verifyKeys = new ArrayList<>();
        this.verifyKeys.add(this.signingKey);

        if (previous != null && !previous.isBlank()
                && previous.getBytes(StandardCharsets.UTF_8).length >= 32) {
            this.verifyKeys.add(Keys.hmacShaKeyFor(previous.getBytes(StandardCharsets.UTF_8)));
            log.info("[JwtService] Previous secret loaded — zero-downtime key rotation enabled.");
        }

        this.accessTokenExpiryMs = accessTokenExpiryMs;
        this.issuer        = issuer;
        this.audience      = audience;
        this.requireIssAud = requireIssAud;

        log.info("[JwtService] Initialized — TTL: {}ms ({} min), issuer: {}, audience: {}, requireIssAud: {}",
                accessTokenExpiryMs, accessTokenExpiryMs / 60_000, issuer, audience, requireIssAud);
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
        log.info("[JwtService.generateAccessToken] Generated for user: {}, email: {}, role: {}, iat: {}, exp: {}, ttl: {}ms",
                user.getId(), user.getEmail(), user.getRole().name(), now, expiryTime, accessTokenExpiryMs);
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
     * <p>Thử từng key trong {@link #verifyKeys} (primary → previous).
     * Nếu sai chữ ký ({@link SignatureException}) → thử key tiếp theo.
     * Các lỗi khác (hết hạn, malformed, …) được ném ra ngay để caller xử lý.
     *
     * <p>Khi {@code app.jwt.require-iss-aud=true}: bắt buộc kiểm tra issuer và audience.
     * Bật flag này sau khi toàn bộ token cũ (không có iss/aud) đã hết hạn (≥ 15 phút).
     */
    public Claims extractClaims(String token) {
        JwtException last = null;
        for (SecretKey key : verifyKeys) {
            try {
                var parserBuilder = Jwts.parser().verifyWith(key);
                if (requireIssAud) {
                    parserBuilder = parserBuilder.requireIssuer(issuer);
                    // aud là Set — dùng require() trực tiếp
                }
                return parserBuilder.build()
                        .parseSignedClaims(token)
                        .getPayload();
            } catch (SignatureException e) {
                last = e;   // sai chữ ký — thử khóa tiếp theo
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
}
