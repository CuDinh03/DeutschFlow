package com.deutschflow.user.mfa;

import com.deutschflow.common.security.JwtService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Token thử thách 2FA ({@code typ=mfa}, phát bởi {@link JwtService#generateMfaChallengeToken}) — đọc, kiểm và
 * ĐỐT sau khi dùng.
 *
 * <p>Token chứng minh "đã qua bước mật khẩu" trong 5 phút. Nó được dùng lại qua các bước đăng ký (gửi mã email
 * → bắt đầu → xác nhận), nhưng một khi đã đổi được ra phiên ({@code /verify}, {@code /enroll/confirm}) hoặc đã
 * được thay bằng token mới ({@code /enroll/start}) thì {@code jti} bị đốt: chép lại token cũ không mở được phiên
 * thứ hai.
 *
 * <p>Lưu {@code jti} đã đốt: Redis {@code SET NX} có TTL bằng phần đời còn lại của token (chung nhiều node);
 * Redis hỏng → bộ nhớ của node (cùng cách {@code SseTicketService}).
 */
@Slf4j
@Service
public class MfaChallengeTokens {

    private static final String KEY_PREFIX = "mfa-burned:";
    private static final int PURGE_THRESHOLD = 512;

    private final JwtService jwtService;
    @Nullable
    private final StringRedisTemplate redis;
    private final ConcurrentHashMap<String, Long> burnedInMemory = new ConcurrentHashMap<>();
    private volatile boolean redisDownWarned = false;

    public MfaChallengeTokens(JwtService jwtService, @Nullable StringRedisTemplate redis) {
        this.jwtService = jwtService;
        this.redis = redis;
    }

    /** Token thử thách đã kiểm: người dùng, {@code jti}, hạn. */
    public record Challenge(long userId, String jti, Instant expiresAt) {}

    public String issue(long userId) {
        return jwtService.generateMfaChallengeToken(userId);
    }

    /**
     * @throws MfaException 400 {@code MFA_TOKEN_INVALID} khi sai chữ ký, hết hạn, không phải {@code typ=mfa},
     *                      subject hỏng, hoặc đã bị đốt
     */
    public Challenge parse(String token) {
        if (token == null || token.isBlank()) {
            throw MfaException.tokenInvalid();
        }
        Claims claims;
        try {
            claims = jwtService.extractClaims(token.trim());
        } catch (JwtException | IllegalArgumentException e) {
            throw MfaException.tokenInvalid();
        }
        if (!JwtService.TYP_MFA.equals(JwtService.tokenType(claims))) {
            throw MfaException.tokenInvalid();
        }
        String sub = claims.getSubject();
        if (sub == null || !sub.startsWith(JwtService.MFA_SUBJECT_PREFIX)) {
            throw MfaException.tokenInvalid();
        }
        long userId;
        try {
            userId = Long.parseLong(sub.substring(JwtService.MFA_SUBJECT_PREFIX.length()));
        } catch (NumberFormatException e) {
            throw MfaException.tokenInvalid();
        }
        String jti = claims.getId();
        if (jti == null || jti.isBlank() || claims.getExpiration() == null) {
            throw MfaException.tokenInvalid();
        }
        Challenge c = new Challenge(userId, jti, claims.getExpiration().toInstant());
        if (isBurned(c)) {
            throw MfaException.tokenInvalid();
        }
        return c;
    }

    /**
     * Đốt token (một lần). {@code false} khi đã có request khác đốt trước — người gọi phải coi như token hỏng
     * (hai request song song cùng một token: đúng một request được phiên).
     */
    public boolean burn(Challenge c) {
        Duration ttl = Duration.between(Instant.now(), c.expiresAt()).plusSeconds(5);
        if (ttl.isNegative() || ttl.isZero()) {
            return false;
        }
        if (redis != null) {
            try {
                Boolean ok = redis.opsForValue().setIfAbsent(KEY_PREFIX + c.jti(), "1", ttl);
                redisDownWarned = false;
                return Boolean.TRUE.equals(ok);
            } catch (Exception e) {
                warnRedis(e);
            }
        }
        if (burnedInMemory.size() > PURGE_THRESHOLD) {
            long now = System.currentTimeMillis();
            burnedInMemory.values().removeIf(exp -> exp < now);
        }
        return burnedInMemory.putIfAbsent(c.jti(), c.expiresAt().toEpochMilli() + 5_000L) == null;
    }

    private boolean isBurned(Challenge c) {
        if (redis != null) {
            try {
                Boolean exists = redis.hasKey(KEY_PREFIX + c.jti());
                redisDownWarned = false;
                return Boolean.TRUE.equals(exists);
            } catch (Exception e) {
                warnRedis(e);
            }
        }
        return burnedInMemory.containsKey(c.jti());
    }

    private void warnRedis(Exception e) {
        if (!redisDownWarned) {
            redisDownWarned = true;
            log.warn("[MfaChallengeTokens] Redis unavailable — falling back to in-memory (single-node): {}", e.getMessage());
        }
    }
}
