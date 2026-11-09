package com.deutschflow.common.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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

/**
 * Xác thực request từ JWT (header {@code Authorization: Bearer}) hoặc one-time SSE ticket.
 *
 * <p><b>Phân loại token (09/11/2026):</b> chỉ nhận làm access token các {@code typ}:
 * <ul>
 *   <li>{@code access} — hoặc thiếu {@code typ} (token phát hành trước bản này, vẫn hợp lệ tới khi hết hạn);</li>
 *   <li>{@code guest} — chỉ khi {@code sub} bắt đầu bằng {@code "guest:"};</li>
 *   <li>{@code support} — chỉ khi {@code app.security.support-session.enabled=true} (mặc định tắt).</li>
 * </ul>
 * {@code mfa} và mọi loại lạ → 401 ngay, không đi tiếp filter chain (cùng cách đường tài khoản bị khoá).
 * Ngược lại, subject {@code "guest:"} phải đi cùng {@code typ=guest} hoặc không có {@code typ}.
 *
 * <p>Claims đã verify được đặt vào {@link AuthTokenAttributes#CLAIMS} để filter sau đọc mà không parse lại.
 */
@Slf4j
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final String GUEST_SUBJECT_PREFIX = "guest:";

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;
    private final SseTicketService sseTicketService;
    private final boolean supportSessionEnabled;

    // Eliminates 1 DB round-trip per authenticated request (S-2/B).
    // 60s TTL keeps staleness well below the JWT lifetime (15 min); stale role is already
    // accepted behaviour — backend re-verifies authorization in OrgGuard/service layer.
    private final Cache<String, UserDetails> userCache = Caffeine.newBuilder()
            .expireAfterWrite(60, TimeUnit.SECONDS)
            .maximumSize(10_000)
            .build();

    public JwtAuthFilter(JwtService jwtService,
                         UserDetailsService userDetailsService,
                         SseTicketService sseTicketService,
                         @Value("${app.security.support-session.enabled:false}") boolean supportSessionEnabled) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
        this.sseTicketService = sseTicketService;
        this.supportSessionEnabled = supportSessionEnabled;
        if (supportSessionEnabled) {
            log.warn("[JwtAuthFilter] app.security.support-session.enabled=true — token typ=support được nhận. "
                    + "Chỉ bật khi bộ lọc chỉ-đọc của phiên hỗ trợ đã có mặt.");
        }
    }

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
            // Chỉ đọc ticket trên GET tới endpoint SSE trong SseTicketEndpoints; method/đường dẫn khác mang
            // ?ticket= → bỏ qua (không xác thực, không tiêu thụ) và đi tiếp như request không có credential.
            // Kiểm đường dẫn TRƯỚC getParameter để không parse body form/multipart của request ghi.
            String ticket = SseTicketEndpoints.accepts(request) ? request.getParameter("ticket") : null;
            if (ticket != null && !ticket.isBlank()) {
                Optional<String> subject = sseTicketService.consume(ticket);
                if (subject.isPresent()
                        && SecurityContextHolder.getContext().getAuthentication() == null
                        && !authenticateRegisteredUser(subject.get(), request, response)) {
                    return; // user no longer exists / disabled — 401 already sent
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

        // Parse + verify MỘT lần; mọi quyết định bên dưới đọc từ claims này.
        final Claims claims;
        try {
            claims = jwtService.extractClaims(token);
        } catch (JwtException | IllegalArgumentException e) {
            // Hết hạn / sai chữ ký / malformed: như trước — không xác thực, đi tiếp (route bảo vệ tự 401).
            log.warn("[JwtAuthFilter] ⚠️ INVALID TOKEN detected for {} ({}) - Token will NOT be used for authentication",
                    requestUri, e.getClass().getSimpleName());
            filterChain.doFilter(request, response);
            return;
        }

        final String subject = claims.getSubject();
        final String typ = JwtService.tokenType(claims);
        final boolean guestSubject = subject != null && subject.startsWith(GUEST_SUBJECT_PREFIX);
        log.debug("[JwtAuthFilter] Token typ={} subject={} for {}", typ, subject, requestUri);

        if (!isAcceptedTokenType(typ, guestSubject, claims)) {
            log.warn("[JwtAuthFilter] Từ chối token typ={} (guestSubject={}) trên {}", typ, guestSubject, requestUri);
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Token type not accepted");
            return;
        }

        request.setAttribute(AuthTokenAttributes.CLAIMS, claims);
        request.setAttribute(AuthTokenAttributes.TOKEN_TYPE, typ);

        // Guest token (subject = "guest:nickname") — không load từ DB; pin trong claim phục vụ quiz submit.
        if (guestSubject) {
            log.debug("[JwtAuthFilter] Setting up GUEST authentication for: {} on {}", subject, requestUri);
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

        if (JwtService.TYP_SUPPORT.equals(typ)) {
            // TODO(admin-w2 phiên hỗ trợ chỉ-đọc): móc cho PR tiếp theo. Khi cờ bật, token support hiện được
            // xác thực Y NHƯ access token của người dùng đích (sub). Bộ lọc phía sau PHẢI đọc
            // AuthTokenAttributes.TOKEN_TYPE == "support" để chặn mọi method ghi, gắn danh tính admin thực
            // hiện (claim tuỳ biến) vào audit log, và kiểm phiên chưa bị thu hồi. Chưa có bộ lọc đó thì cờ
            // app.security.support-session.enabled phải giữ false (isAcceptedTokenType đã trả 401).
            log.info("[JwtAuthFilter] Support-session token trên {} (subject={})", requestUri, subject);
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
     * Loại token được nhận làm credential cho request API.
     * <ul>
     *   <li>subject {@code guest:} ↔ chỉ {@code typ=guest} hoặc không có {@code typ} (token khách cũ);</li>
     *   <li>{@code typ=guest} mà subject không phải {@code guest:} → từ chối;</li>
     *   <li>{@code access} (gồm token thiếu {@code typ}) → nhận;</li>
     *   <li>{@code support} → chỉ khi bật cờ;</li>
     *   <li>{@code mfa} và loại lạ → từ chối.</li>
     * </ul>
     */
    private boolean isAcceptedTokenType(String typ, boolean guestSubject, Claims claims) {
        if (guestSubject) {
            return JwtService.TYP_GUEST.equals(typ) || JwtService.isLegacyUntyped(claims);
        }
        return switch (typ) {
            case JwtService.TYP_ACCESS -> true;
            case JwtService.TYP_SUPPORT -> supportSessionEnabled;
            default -> false; // mfa, guest (subject không phải guest:), loại lạ
        };
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
