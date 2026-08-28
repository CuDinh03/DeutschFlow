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
import java.util.Arrays;
import java.util.List;

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
 * <p><b>Mở rộng (audit 24/08):</b> filter còn phủ vài đường permitAll nằm NGOÀI cây {@code /api/public/}
 * — {@code /api/onboarding/preview/**} (xem trước mentor cho khách) và {@code /api/v2/media/by-tag}
 * (media landing) — vốn không có lớp rate-limit ứng dụng nào, chỉ dựa vào nginx. Đây là defense in
 * depth đối xứng với việc bind backend về localhost: nếu một ngày cổng backend lại hở ra ngoài
 * (rule security group thêm lại nhầm) thì các đường này vẫn còn một lớp chặn, y như {@code /api/public/}.
 * Nhóm mở rộng dùng NGÂN SÁCH RIÊNG, rộng hơn hẳn (mặc định 120/phút) và khoá key riêng, để một lớp
 * học sau NAT trường hay một trang landing tải nhiều media KHÔNG bị chặn oan — đây là đường đọc công
 * khai, không phải đường ghi nhạy cảm.
 *
 * <p>KHÔNG phủ: {@code /api/auth/**} (đã có limiter chặt riêng), webhook thanh toán (bên thứ ba gọi,
 * chặn theo IP sẽ giết retry hợp lệ), {@code /actuator/health} (uptime monitor poll).
 *
 * <p>Cấu hình qua env: {@code APP_SECURITY_PUBLIC_RATE_LIMIT_PER_MINUTE} (mặc định 30),
 * {@code APP_SECURITY_PUBLIC_RATE_LIMIT_ENABLED} (mặc định true),
 * {@code APP_SECURITY_UNAUTH_RATE_LIMIT_PATHS} (CSV prefix) và
 * {@code APP_SECURITY_UNAUTH_RATE_LIMIT_PER_MINUTE} (mặc định 120).
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
    private final List<String> extraPrefixes;
    private final int extraPerMinute;
    private volatile boolean redisDownWarned = false;

    public PublicApiRateLimitFilter(
            ClientIpResolver clientIpResolver,
            @Nullable StringRedisTemplate redis,
            @Value("${app.security.public-rate-limit.enabled:true}") boolean enabled,
            @Value("${app.security.public-rate-limit.per-minute:30}") int perMinute,
            @Value("${app.security.unauth-rate-limit.paths:/api/onboarding/preview/,/api/onboarding/guest-session,/api/v2/media/by-tag}") String extraPathsCsv,
            @Value("${app.security.unauth-rate-limit.per-minute:120}") int extraPerMinute) {
        this.clientIpResolver = clientIpResolver;
        this.redis = redis;
        this.enabled = enabled;
        this.perMinute = perMinute;
        this.extraPerMinute = Math.max(1, extraPerMinute);
        this.extraPrefixes = Arrays.stream(extraPathsCsv.split(","))
                .map(String::trim)
                .filter(p -> !p.isEmpty())
                .toList();
    }

    /** true nếu URI khớp một trong các prefix unauth mở rộng. */
    private boolean isExtraPath(String uri) {
        for (String prefix : extraPrefixes) {
            if (uri.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!enabled) {
            return true;
        }
        String uri = request.getRequestURI();
        return !uri.startsWith(PUBLIC_PREFIX) && !isExtraPath(uri);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        boolean extra = isExtraPath(request.getRequestURI());
        String keyPrefix = extra ? "rl:unauth:" : "rl:public:";
        int limit = extra ? extraPerMinute : perMinute;
        if (!allow(clientIpResolver.resolve(request), keyPrefix, limit)) {
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
    private boolean allow(String clientIp, String keyPrefix, int limit) {
        if (redis == null) {
            return true;
        }
        try {
            String key = keyPrefix + clientIp + ":" + (Instant.now().getEpochSecond() / 60L);
            Long count = redis.opsForValue().increment(key);
            if (count != null && count == 1L) {
                // 65s > cửa sổ 60s: key tự dọn kể cả khi lệch đồng hồ nhẹ giữa các node.
                redis.expire(key, Duration.ofSeconds(65));
            }
            boolean allowed = count == null || count <= limit;
            if (!allowed && count == limit + 1L) {
                // Log đúng một lần tại thời điểm vượt ngưỡng (không spam mỗi request bị chặn).
                log.warn("[PublicRateLimit] IP bị chặn tạm: {} vượt {} req/phút (bucket {})",
                        clientIp, limit, keyPrefix);
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
