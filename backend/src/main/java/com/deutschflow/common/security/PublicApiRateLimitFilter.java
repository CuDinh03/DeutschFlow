package com.deutschflow.common.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;

/**
 * M-2/L-5 (audit B2B 07-04): {@code /api/public/**} là bề mặt permitAll (invite preview/accept,
 * cert verify, grade-report, free-grade, org-invitations) nhưng trước đây KHÔNG có throttle nào —
 * FreeTierGuard là cap theo feature, không phải rate-limit. Filter này áp fixed-window theo IP
 * cho TOÀN BỘ cây public (free-grade vẫn giữ cap riêng chặt hơn của LeadMagnetService — hai lớp
 * chồng nhau vô hại).
 *
 * <p>Fixed-window Redis {@code INCR} theo (IP, phút) — chia sẻ giữa các node. Redis lỗi/thiếu →
 * <b>fail-open</b> (public API tiếp tục sống, log cảnh báo một lần) — throttle là lớp chống lạm
 * dụng, không phải lớp bảo mật, nên không được làm sập trải nghiệm hợp lệ khi hạ tầng phụ trợ chết.
 *
 * <p>Cấu hình qua env: {@code APP_SECURITY_PUBLIC_RATE_LIMIT_PER_MINUTE} (mặc định 30),
 * {@code APP_SECURITY_PUBLIC_RATE_LIMIT_ENABLED} (mặc định true).
 */
@Component
@Slf4j
public class PublicApiRateLimitFilter extends OncePerRequestFilter {

    private static final String PUBLIC_PREFIX = "/api/public/";

    private final ClientIpResolver clientIpResolver;
    @Nullable
    private final StringRedisTemplate redis;
    private final boolean enabled;
    private final int perMinute;
    private volatile boolean redisDownWarned = false;

    public PublicApiRateLimitFilter(
            ClientIpResolver clientIpResolver,
            @Nullable StringRedisTemplate redis,
            @Value("${app.security.public-rate-limit.enabled:true}") boolean enabled,
            @Value("${app.security.public-rate-limit.per-minute:30}") int perMinute) {
        this.clientIpResolver = clientIpResolver;
        this.redis = redis;
        this.enabled = enabled;
        this.perMinute = perMinute;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !enabled || !request.getRequestURI().startsWith(PUBLIC_PREFIX);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (!allow(clientIpResolver.resolve(request))) {
            long epochSecond = Instant.now().getEpochSecond();
            long retryAfter = 60L - (epochSecond % 60L);
            response.setStatus(429);
            response.setHeader("Retry-After", Long.toString(retryAfter));
            // Charset tường minh — thiếu là message tiếng Việt thành mojibake ở client.
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getOutputStream().write(
                    "{\"status\":429,\"detail\":\"Quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.\"}"
                            .getBytes(StandardCharsets.UTF_8));
            return;
        }
        filterChain.doFilter(request, response);
    }

    /** true = cho qua. Fixed-window (IP, phút); Redis chết → fail-open. */
    private boolean allow(String clientIp) {
        if (redis == null) {
            return true;
        }
        try {
            String key = "rl:public:" + clientIp + ":" + (Instant.now().getEpochSecond() / 60L);
            Long count = redis.opsForValue().increment(key);
            if (count != null && count == 1L) {
                // 65s > cửa sổ 60s: key tự dọn kể cả khi lệch đồng hồ nhẹ giữa các node.
                redis.expire(key, Duration.ofSeconds(65));
            }
            boolean allowed = count == null || count <= perMinute;
            if (!allowed && count == perMinute + 1L) {
                // Log đúng một lần tại thời điểm vượt ngưỡng (không spam mỗi request bị chặn).
                log.warn("[PublicRateLimit] IP bị chặn tạm: {} vượt {} req/phút trên /api/public/**",
                        clientIp, perMinute);
            }
            return allowed;
        } catch (Exception e) {
            if (!redisDownWarned) {
                redisDownWarned = true;
                log.warn("[PublicRateLimit] Redis không phản hồi — tạm fail-open cho /api/public/**", e);
            }
            return true;
        }
    }
}
