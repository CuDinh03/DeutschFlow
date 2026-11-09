package com.deutschflow.admin.support;

import com.deutschflow.common.security.JwtService;
import com.deutschflow.common.security.support.SupportSessionContext;
import com.deutschflow.common.security.support.SupportSessionValidator;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.jsonwebtoken.Claims;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

/**
 * Xác minh token {@code typ=support} mỗi request (gọi từ {@code JwtAuthFilter}), fail-closed:
 * <ul>
 *   <li>phiên ({@code sup}) tồn tại, {@code ended_at} NULL, {@code expires_at} còn ở tương lai;</li>
 *   <li>admin của phiên == claim {@code act}, vẫn tồn tại, đang hoạt động, vai trò ADMIN;</li>
 *   <li>người dùng đích của phiên == claim {@code userId}, email == {@code sub}, đang hoạt động, KHÔNG phải ADMIN.</li>
 * </ul>
 *
 * <p>Dòng phiên + trạng thái hai người dùng được cache tối đa {@value #CACHE_SECONDS} s (Caffeine, cục bộ từng
 * node); {@link #evict(long)} xoá ngay khi phiên bị đóng trên node này. DB là nguồn sự thật: node khác thấy phiên
 * đóng chậm nhất {@value #CACHE_SECONDS} s. Hết hạn ({@code expires_at}) được so với đồng hồ mỗi request, không
 * phụ thuộc cache.
 */
@Slf4j
@Component
public class SupportSessionVerifier implements SupportSessionValidator {

    static final int CACHE_SECONDS = 10;

    private final SupportSessionStore store;
    private final Clock clock;
    private final Cache<Long, Optional<SupportSessionStore.VerificationRow>> cache = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofSeconds(CACHE_SECONDS))
            .maximumSize(1_000)
            .build();

    @org.springframework.beans.factory.annotation.Autowired
    public SupportSessionVerifier(SupportSessionStore store) {
        this(store, Clock.systemUTC());
    }

    SupportSessionVerifier(SupportSessionStore store, Clock clock) {
        this.store = store;
        this.clock = clock;
    }

    @Override
    public Optional<SupportSessionContext> validate(Claims claims) {
        if (claims == null || !JwtService.TYP_SUPPORT.equals(JwtService.tokenType(claims))) {
            return Optional.empty();
        }
        Long sessionId = JwtService.longClaim(claims, JwtService.CLAIM_SUPPORT_SESSION);
        Long actorId = JwtService.longClaim(claims, JwtService.CLAIM_ACTOR);
        Long userId = JwtService.longClaim(claims, "userId");
        String subject = claims.getSubject();
        if (sessionId == null || actorId == null || userId == null || subject == null) {
            return Optional.empty();
        }
        Optional<SupportSessionStore.VerificationRow> cached = cache.get(sessionId, store::loadForVerification);
        if (cached == null || cached.isEmpty()) {
            return Optional.empty();
        }
        SupportSessionStore.VerificationRow row = cached.get();
        Instant now = clock.instant();
        String failure = null;
        if (row.endedAt() != null) {
            failure = "ended";
        } else if (row.expiresAt() == null || !row.expiresAt().isAfter(now)) {
            failure = "expired";
        } else if (row.adminUserId() != actorId) {
            failure = "actor mismatch";
        } else if (!row.adminActive() || !"ADMIN".equals(row.adminRole())) {
            failure = "admin no longer an active ADMIN";
        } else if (row.targetUserId() != userId) {
            failure = "userId mismatch";
        } else if (row.targetEmail() == null || !row.targetEmail().equalsIgnoreCase(subject)) {
            failure = "subject mismatch";
        } else if (!row.targetActive() || "ADMIN".equals(row.targetRole())) {
            failure = "target inactive or ADMIN";
        }
        if (failure != null) {
            log.info("[SupportSession] Từ chối token phiên {}: {}", sessionId, failure);
            return Optional.empty();
        }
        return Optional.of(new SupportSessionContext(row.id(), row.adminUserId(), row.adminEmail(), row.targetUserId()));
    }

    /** Xoá cache của một phiên (gọi khi phiên đóng trên node này). */
    public void evict(long sessionId) {
        cache.invalidate(sessionId);
    }
}
