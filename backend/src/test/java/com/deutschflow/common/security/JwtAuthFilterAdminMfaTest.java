package com.deutschflow.common.security;

import com.deutschflow.user.entity.User;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * {@link JwtAuthFilter} đòi dấu 2FA ({@code mfa=true}) trên access token của người dùng ADMIN khi
 * {@code app.security.admin-mfa.enforced=true}; người dùng thường và SSE ticket không đổi.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("JwtAuthFilter — 2FA bắt buộc cho ADMIN")
class JwtAuthFilterAdminMfaTest {

    private static final String SECRET = "abcdefghijklmnopqrstuvwxyz0123456789abcdef";

    private final JwtService jwtService = new JwtService(SECRET, "", 3_600_000L,
            "deutschflow-api", "deutschflow-app", false, "HS256", "", "", "");

    @Mock
    private UserDetailsService userDetailsService;
    @Mock
    private SseTicketService sseTicketService;

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private JwtAuthFilter filter(boolean enforced) {
        return new JwtAuthFilter(jwtService, userDetailsService, sseTicketService, false, enforced);
    }

    private static User admin() {
        return User.builder().id(1L).email("owner@deutschflow.app").passwordHash("h").displayName("Owner")
                .role(User.Role.ADMIN).locale(User.Locale.vi).active(true).build();
    }

    private static User student() {
        return User.builder().id(2L).email("hv@x.com").passwordHash("h").displayName("HV")
                .role(User.Role.STUDENT).locale(User.Locale.vi).active(true).build();
    }

    private record Result(MockHttpServletResponse response, MockFilterChain chain) {
        boolean chainCalled() {
            return chain.getRequest() != null;
        }
    }

    private Result run(JwtAuthFilter f, MockHttpServletRequest req) throws Exception {
        MockHttpServletResponse res = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        f.doFilter(req, res, chain);
        return new Result(res, chain);
    }

    private static MockHttpServletRequest bearer(String token) {
        MockHttpServletRequest r = new MockHttpServletRequest("GET", "/api/admin/users");
        r.addHeader("Authorization", "Bearer " + token);
        return r;
    }

    @Test
    @DisplayName("ADMIN + token không có mfa → 401 problem+json MFA_REQUIRED, không đi tiếp, không xác thực")
    void adminWithoutMfaRejected() throws Exception {
        when(userDetailsService.loadUserByUsername("owner@deutschflow.app")).thenReturn(admin());

        Result r = run(filter(true), bearer(jwtService.generateAccessToken(admin())));

        assertThat(r.response().getStatus()).isEqualTo(HttpServletResponse.SC_UNAUTHORIZED);
        assertThat(r.response().getContentType()).startsWith("application/problem+json");
        assertThat(r.response().getContentAsString()).contains("\"code\":\"MFA_REQUIRED\"");
        assertThat(r.chainCalled()).isFalse();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    @DisplayName("ADMIN + token có mfa=true → qua, principal là admin")
    void adminWithMfaAccepted() throws Exception {
        when(userDetailsService.loadUserByUsername("owner@deutschflow.app")).thenReturn(admin());

        Result r = run(filter(true), bearer(jwtService.generateAccessToken(admin(), null, null, Instant.now())));

        assertThat(r.chainCalled()).isTrue();
        assertThat(r.response().getStatus()).isEqualTo(200);
        assertThat(SecurityContextHolder.getContext().getAuthentication().getPrincipal()).isInstanceOf(User.class);
    }

    @Test
    @DisplayName("Kill-switch tắt (enforced=false) → ADMIN không dấu 2FA vẫn qua")
    void killSwitchOff() throws Exception {
        when(userDetailsService.loadUserByUsername("owner@deutschflow.app")).thenReturn(admin());

        Result r = run(filter(false), bearer(jwtService.generateAccessToken(admin())));

        assertThat(r.chainCalled()).isTrue();
    }

    @Test
    @DisplayName("Người dùng thường không cần dấu 2FA")
    void nonAdminUnaffected() throws Exception {
        when(userDetailsService.loadUserByUsername("hv@x.com")).thenReturn(student());

        Result r = run(filter(true), bearer(jwtService.generateAccessToken(student())));

        assertThat(r.chainCalled()).isTrue();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
    }

    @Test
    @DisplayName("Vai trò đọc từ DB: token ghi role=STUDENT nhưng người dùng nay là ADMIN → vẫn đòi 2FA")
    void roleFromDbNotFromClaim() throws Exception {
        when(userDetailsService.loadUserByUsername("hv@x.com")).thenReturn(
                User.builder().id(2L).email("hv@x.com").passwordHash("h").role(User.Role.ADMIN).active(true).build());

        Result r = run(filter(true), bearer(jwtService.generateAccessToken(student())));

        assertThat(r.response().getStatus()).isEqualTo(HttpServletResponse.SC_UNAUTHORIZED);
        assertThat(r.chainCalled()).isFalse();
    }

    @Test
    @DisplayName("SSE ticket của ADMIN: không kiểm lại 2FA (ticket chỉ phát từ request Bearer đã qua 2FA)")
    void sseTicketSkipsMfaCheck() throws Exception {
        when(sseTicketService.consume("tkt")).thenReturn(Optional.of("owner@deutschflow.app"));
        when(userDetailsService.loadUserByUsername("owner@deutschflow.app")).thenReturn(admin());
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/notifications/stream");
        req.setParameter("ticket", "tkt");

        Result r = run(filter(true), req);

        assertThat(r.chainCalled()).isTrue();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
    }
}
