package com.deutschflow.common.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");
        String requestUri = request.getRequestURI();

        // Support query param ?access_token=... for SSE connections
        // (browser EventSource API cannot set custom headers)
        String token = null;
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
        } else {
            String queryToken = request.getParameter("access_token");
            if (queryToken != null && !queryToken.isBlank()) {
                token = queryToken;
            }
        }

        if (token == null) {
            log.debug("[JwtAuthFilter] No token found for {}", requestUri);
            filterChain.doFilter(request, response);
            return;
        }

        log.debug("[JwtAuthFilter] Token found for request: {}", requestUri);
        log.debug("[JwtAuthFilter] Token length: {}", token.length());

        boolean isTokenValid = jwtService.isTokenValid(token);
        log.debug("[JwtAuthFilter] Token valid: {} for {}", isTokenValid, requestUri);

        if (!isTokenValid) {
            log.warn("[JwtAuthFilter] ⚠️ INVALID TOKEN detected for {} - Token will NOT be used for authentication", requestUri);
            filterChain.doFilter(request, response);
            return;
        }

        if (SecurityContextHolder.getContext().getAuthentication() != null) {
            log.debug("[JwtAuthFilter] Authentication already set for {}", requestUri);
            filterChain.doFilter(request, response);
            return;
        }

        final String subject = jwtService.extractEmail(token);
        log.debug("[JwtAuthFilter] Extracted email/subject from token: {} for request: {}", subject, requestUri);

        // Guest token (subject = "guest:nickname") — không load từ DB; pin trong claim phục vụ quiz submit.
        if (subject != null && subject.startsWith("guest:")) {
            log.info("[JwtAuthFilter] Setting up GUEST authentication for: {} on {}", subject, requestUri);
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
            log.info("[JwtAuthFilter] ✓ GUEST authentication set for {} on {}", subject, requestUri);
            filterChain.doFilter(request, response);
            return;
        }

        // Registered user — load từ DB
        if (subject != null) {
            try {
                log.debug("[JwtAuthFilter] Loading user details for: {} from database", subject);
                var userDetails = userDetailsService.loadUserByUsername(subject);
                log.debug("[JwtAuthFilter] User loaded successfully: {}, authorities: {}", subject, userDetails.getAuthorities());
                var auth = new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());
                auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(auth);
                log.info("[JwtAuthFilter] ✓ USER AUTHENTICATION SET for {} with authorities {} on {}",
                    subject, userDetails.getAuthorities(), requestUri);
            } catch (UsernameNotFoundException ex) {
                log.warn("[JwtAuthFilter] ⚠️ User not found in database: {} for request {}", subject, requestUri);
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "User no longer exists");
                return;
            }
        } else {
            log.warn("[JwtAuthFilter] ⚠️ No subject extracted from token for request: {}", requestUri);
        }

        filterChain.doFilter(request, response);
    }
}
