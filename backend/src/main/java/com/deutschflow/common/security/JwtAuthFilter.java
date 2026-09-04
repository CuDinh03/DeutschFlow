package com.deutschflow.common.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;
    private final SseTicketService sseTicketService;

    // Eliminates 1 DB round-trip per authenticated request (S-2/B).
    // 60s TTL keeps staleness well below the JWT lifetime (15 min); stale role is already
    // accepted behaviour — backend re-verifies authorization in OrgGuard/service layer.
    private final Cache<String, UserDetails> userCache = Caffeine.newBuilder()
            .expireAfterWrite(60, TimeUnit.SECONDS)
            .maximumSize(10_000)
            .build();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");
        String requestUri = request.getRequestURI();

        String token = null;
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
        } else {
            // SSE / EventSource auth — the browser API can't set custom headers.
            // Preferred: one-time ?ticket= (S15) — opaque, single-use, ~60s TTL; safe even if logged.
            String ticket = request.getParameter("ticket");
            if (ticket != null && !ticket.isBlank()) {
                Optional<String> subject = sseTicketService.consume(ticket);
                if (subject.isPresent()
                        && SecurityContextHolder.getContext().getAuthentication() == null
                        && !authenticateRegisteredUser(subject.get(), request, response)) {
                    return; // user no longer exists — 401 already sent
                }
                log.debug("[JwtAuthFilter] SSE ticket {} for {}",
                        subject.isPresent() ? "accepted" : "rejected", requestUri);
                filterChain.doFilter(request, response);
                return;
            }
            // The legacy ?access_token=<JWT> query fallback was REMOVED here (S15b / P2-6): it leaked the
            // bearer token into access/proxy logs, browser history, and the Referer header. All SSE clients
            // now authenticate via the one-time ?ticket= above (EventSource) or fetch with an Authorization
            // header. No Bearer header + no ticket → unauthenticated; protected routes 401 below.
        }

        if (token == null) {
            log.debug("[JwtAuthFilter] No token found for {}", requestUri);
            filterChain.doFilter(request, response);
            return;
        }

        log.debug("[JwtAuthFilter] Token found for request: {}", requestUri);
        log.debug("[JwtAuthFilter] Token length: {}", token.length());

        // Check TRƯỚC khi validate: filter đứng trước có thể đã xác thực bằng credential không phải
        // JWT (PrometheusScrapeTokenFilter với bearer token tĩnh) — validate tiếp vừa parse thừa vừa
        // spam WARN "INVALID TOKEN" mỗi lần scrape 15s.
        if (SecurityContextHolder.getContext().getAuthentication() != null) {
            log.debug("[JwtAuthFilter] Authentication already set for {}", requestUri);
            filterChain.doFilter(request, response);
            return;
        }

        boolean isTokenValid = jwtService.isTokenValid(token);
        log.debug("[JwtAuthFilter] Token valid: {} for {}", isTokenValid, requestUri);

        if (!isTokenValid) {
            log.warn("[JwtAuthFilter] ⚠️ INVALID TOKEN detected for {} - Token will NOT be used for authentication", requestUri);
            filterChain.doFilter(request, response);
            return;
        }

        final String subject = jwtService.extractEmail(token);
        log.debug("[JwtAuthFilter] Extracted email/subject from token: {} for request: {}", subject, requestUri);

        // Guest token (subject = "guest:nickname") — không load từ DB; pin trong claim phục vụ quiz submit.
        if (subject != null && subject.startsWith("guest:")) {
            log.debug("[JwtAuthFilter] Setting up GUEST authentication for: {} on {}", subject, requestUri);
            var claims  = jwtService.extractClaims(token);
            var pinCode = claims.get("pinCode", String.class);
            var auth = new UsernamePasswordAuthenticationToken(
                    subject,
                    null,
                    List.of(new SimpleGrantedAuthority("ROLE_GUEST"))
            );
            auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            request.setAttribute("guestPinCode", pinCode);
            SecurityContextHolder.getContext().setAuthentication(auth);
            log.debug("[JwtAuthFilter] ✓ GUEST authentication set for {} on {}", subject, requestUri);
            filterChain.doFilter(request, response);
            return;
        }

        // Registered user — load từ DB
        if (subject != null) {
            if (!authenticateRegisteredUser(subject, request, response)) {
                return; // user no longer exists — 401 already sent
            }
        } else {
            log.warn("[JwtAuthFilter] ⚠️ No subject extracted from token for request: {}", requestUri);
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Load a registered user by subject (email) and set the SecurityContext. Returns false (and
     * sends 401) when the user no longer exists. Shared by the JWT and SSE-ticket auth paths.
     */
    private boolean authenticateRegisteredUser(String subject,
                                               HttpServletRequest request,
                                               HttpServletResponse response) throws IOException {
        try {
            var userDetails = userCache.get(subject, userDetailsService::loadUserByUsername);
            // Audit F-H2 (03/09/2026): filter tự dựng Authentication nên KHÔNG đi qua
            // AccountStatusUserDetailsChecker của DaoAuthenticationProvider — trước đây một tài khoản
            // bị admin khoá vẫn dùng tiếp access token đang cầm cho tới khi hết hạn. Kiểm tường minh
            // ở đây; độ trễ tối đa là TTL 60s của userCache bên trên.
            if (!userDetails.isEnabled()) {
                log.warn("[JwtAuthFilter] Tài khoản đã bị khóa vẫn trình token: {} trên {}",
                        subject, request.getRequestURI());
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Account is disabled");
                return false;
            }
            var auth = new UsernamePasswordAuthenticationToken(
                    userDetails, null, userDetails.getAuthorities());
            auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(auth);
            // DEBUG, không phải INFO: dòng này bắn MỖI request đã đăng nhập (kèm email) — ở INFO nó
            // là dòng log nhiều nhất hệ thống, đổ thẳng vào promtail/Loki chạy cùng máy 2 vCPU.
            log.debug("[JwtAuthFilter] ✓ USER AUTHENTICATION SET for {} with authorities {} on {}",
                    subject, userDetails.getAuthorities(), request.getRequestURI());
            return true;
        } catch (UsernameNotFoundException ex) {
            log.warn("[JwtAuthFilter] ⚠️ User not found: {} for request {}", subject, request.getRequestURI());
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "User no longer exists");
            return false;
        }
    }
}
