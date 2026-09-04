package com.deutschflow.common.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

/**
 * Xác thực scrape của Prometheus bằng bearer token TĨNH, chỉ cho đúng một path
 * {@code /actuator/prometheus} (SecurityConfig yêu cầu ROLE_PROMETHEUS hoặc ADMIN ở prod).
 *
 * Vì sao không mở theo IP nội bộ: backend publish 127.0.0.1:8080 qua docker-proxy nên mọi request
 * nginx chuyển tiếp (tức traffic internet) vào container đều mang remoteAddr = gateway bridge
 * (172.17.0.1) — không phân biệt được với Prometheus trong mạng docker; còn lớp deny /actuator/*
 * ở nginx đã drift trên host (02/09: curl từ internet nhận 401 của app thay vì 403 của nginx).
 * Token tĩnh không phụ thuộc topology mạng lẫn nginx.
 *
 * Fail-closed: PROMETHEUS_SCRAPE_TOKEN rỗng → filter bất hoạt, /actuator/prometheus giữ nguyên
 * ADMIN-only như trước. Phía scrape: prometheus.yml đọc token từ credentials_file
 * docker/prometheus/scrape-token (gitignored — tạo tay trên EC2, cùng giá trị với env backend).
 */
@Component
public class PrometheusScrapeTokenFilter extends OncePerRequestFilter {

    static final String SCRAPE_PATH = "/actuator/prometheus";
    private static final String BEARER_PREFIX = "Bearer ";

    private final byte[] expectedToken;

    public PrometheusScrapeTokenFilter(
            @Value("${app.security.prometheus-scrape-token:}") String scrapeToken) {
        this.expectedToken = (scrapeToken == null || scrapeToken.isBlank())
                ? null
                : scrapeToken.trim().getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return expectedToken == null || !SCRAPE_PATH.equals(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith(BEARER_PREFIX)
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            byte[] presented = header.substring(BEARER_PREFIX.length()).trim()
                    .getBytes(StandardCharsets.UTF_8);
            // MessageDigest.isEqual: so sánh constant-time — không lộ vị trí sai qua timing.
            if (MessageDigest.isEqual(expectedToken, presented)) {
                var auth = new UsernamePasswordAuthenticationToken(
                        "prometheus-scraper", null,
                        List.of(new SimpleGrantedAuthority("ROLE_PROMETHEUS")));
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }
        // Token sai/thiếu: không set auth — rơi xuống rule hasAnyRole(ADMIN, PROMETHEUS) → 401.
        filterChain.doFilter(request, response);
    }
}
