package com.deutschflow.common.security;

import com.deutschflow.admin.support.SupportSessionStore;
import com.deutschflow.admin.support.SupportSessionVerifier;
import com.deutschflow.common.security.support.SupportSessionContext;
import com.deutschflow.common.security.support.SupportSessionContextHolder;
import com.deutschflow.user.entity.User;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;

import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Nhánh {@code typ=support} của {@link JwtAuthFilter} với {@link SupportSessionVerifier} THẬT (store giả):
 * phiên hợp lệ → xác thực như người dùng đích + ngữ cảnh phiên trên request/ThreadLocal (dọn sau chain); phiên
 * đã đóng, admin bị hạ quyền, userId lệch → 401 {@code SUPPORT_SESSION_ENDED}.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("JwtAuthFilter — token phiên hỗ trợ")
class JwtAuthFilterSupportSessionTest {

    private static final String SECRET = "abcdefghijklmnopqrstuvwxyz0123456789abcdef";
    private static final String TARGET_EMAIL = "hocvien@deutschflow.app";

    private final JwtService jwtService = new JwtService(SECRET, "", 3_600_000L,
            "deutschflow-api", "deutschflow-app", false, "HS256", "", "", "");

    @Mock private UserDetailsService userDetailsService;
    @Mock private SseTicketService sseTicketService;
    @Mock private SupportSessionStore store;

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
        SupportSessionContextHolder.clear();
    }

    private static User target() {
        return User.builder().id(9L).email(TARGET_EMAIL).displayName("Hoc Vien").passwordHash("h")
                .role(User.Role.STUDENT).locale(User.Locale.vi).active(true).build();
    }

    private String supportToken(long sessionId, long adminId, User user) {
        return jwtService.generateSupportToken(user, null, null, adminId, sessionId,
                Instant.now().plusSeconds(1800));
    }

    private static SupportSessionStore.VerificationRow row(Instant endedAt, String adminRole, boolean adminActive,
                                                          long targetId, String targetRole) {
        return new SupportSessionStore.VerificationRow(77L, 1L, targetId, Instant.now().plusSeconds(600), endedAt,
                "admin@df.test", adminRole, adminActive, TARGET_EMAIL, targetRole, true);
    }

    private JwtAuthFilter filter() {
        return new JwtAuthFilter(jwtService, userDetailsService, sseTicketService, true, true,
                new SupportSessionVerifier(store));
    }

    private static MockHttpServletRequest bearer(String token) {
        MockHttpServletRequest r = new MockHttpServletRequest("GET", "/api/srs/due");
        r.addHeader("Authorization", "Bearer " + token);
        return r;
    }

    @Test
    @DisplayName("phiên hợp lệ → xác thực như người dùng đích, ngữ cảnh phiên có trong chain và được dọn sau đó")
    void validSessionAuthenticatesAsTarget() throws Exception {
        when(store.loadForVerification(77L)).thenReturn(Optional.of(row(null, "ADMIN", true, 9L, "STUDENT")));
        when(userDetailsService.loadUserByUsername(TARGET_EMAIL)).thenReturn(target());
        AtomicReference<SupportSessionContext> seen = new AtomicReference<>();
        AtomicReference<Object> principal = new AtomicReference<>();
        FilterChain chain = (req, res) -> {
            seen.set(SupportSessionContextHolder.current());
            principal.set(SecurityContextHolder.getContext().getAuthentication().getPrincipal());
            assertThat(req.getAttribute(SupportSessionContext.REQUEST_ATTRIBUTE)).isEqualTo(seen.get());
        };
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter().doFilter(bearer(supportToken(77L, 1L, target())), res, chain);

        assertThat(res.getStatus()).isEqualTo(200);
        assertThat(seen.get()).isEqualTo(new SupportSessionContext(77L, 1L, "admin@df.test", 9L));
        assertThat(((User) principal.get()).getId()).isEqualTo(9L);
        assertThat(SupportSessionContextHolder.current()).as("ThreadLocal dọn trong finally").isNull();
    }

    @Test
    @DisplayName("phiên đã kết thúc → 401 SUPPORT_SESSION_ENDED, không đi tiếp")
    void endedSessionRejected() throws Exception {
        when(store.loadForVerification(77L)).thenReturn(Optional.of(row(Instant.now(), "ADMIN", true, 9L, "STUDENT")));
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter().doFilter(bearer(supportToken(77L, 1L, target())), res, failingChain());

        assertThat(res.getStatus()).isEqualTo(HttpServletResponse.SC_UNAUTHORIZED);
        assertThat(res.getContentAsString()).contains("SUPPORT_SESSION_ENDED");
        verify(userDetailsService, never()).loadUserByUsername(anyString());
    }

    @Test
    @DisplayName("admin bị hạ quyền (không còn ADMIN) → 401")
    void demotedAdminRejected() throws Exception {
        when(store.loadForVerification(77L)).thenReturn(Optional.of(row(null, "TEACHER", true, 9L, "STUDENT")));
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter().doFilter(bearer(supportToken(77L, 1L, target())), res, failingChain());
        assertThat(res.getStatus()).isEqualTo(401);
    }

    @Test
    @DisplayName("admin bị khoá → 401")
    void deactivatedAdminRejected() throws Exception {
        when(store.loadForVerification(77L)).thenReturn(Optional.of(row(null, "ADMIN", false, 9L, "STUDENT")));
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter().doFilter(bearer(supportToken(77L, 1L, target())), res, failingChain());
        assertThat(res.getStatus()).isEqualTo(401);
    }

    @Test
    @DisplayName("userId trong token lệch người dùng đích của phiên → 401")
    void userIdMismatchRejected() throws Exception {
        when(store.loadForVerification(77L)).thenReturn(Optional.of(row(null, "ADMIN", true, 10L, "STUDENT")));
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter().doFilter(bearer(supportToken(77L, 1L, target())), res, failingChain());
        assertThat(res.getStatus()).isEqualTo(401);
    }

    @Test
    @DisplayName("act (admin) trong token lệch admin của phiên → 401")
    void actorMismatchRejected() throws Exception {
        when(store.loadForVerification(77L)).thenReturn(Optional.of(row(null, "ADMIN", true, 9L, "STUDENT")));
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter().doFilter(bearer(supportToken(77L, 2L, target())), res, failingChain());
        assertThat(res.getStatus()).isEqualTo(401);
    }

    @Test
    @DisplayName("đích đã thành ADMIN → 401")
    void targetPromotedToAdminRejected() throws Exception {
        when(store.loadForVerification(77L)).thenReturn(Optional.of(row(null, "ADMIN", true, 9L, "ADMIN")));
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter().doFilter(bearer(supportToken(77L, 1L, target())), res, failingChain());
        assertThat(res.getStatus()).isEqualTo(401);
    }

    @Test
    @DisplayName("phiên không tồn tại → 401")
    void unknownSessionRejected() throws Exception {
        when(store.loadForVerification(77L)).thenReturn(Optional.empty());
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter().doFilter(bearer(supportToken(77L, 1L, target())), res, failingChain());
        assertThat(res.getStatus()).isEqualTo(401);
    }

    @Test
    @DisplayName("kill-switch (cờ tắt) → 401 kể cả phiên hợp lệ, không chạm DB")
    void killSwitch() throws Exception {
        lenient().when(store.loadForVerification(77L)).thenReturn(Optional.of(row(null, "ADMIN", true, 9L, "STUDENT")));
        JwtAuthFilter off = new JwtAuthFilter(jwtService, userDetailsService, sseTicketService, false, true,
                new SupportSessionVerifier(store));
        MockHttpServletResponse res = new MockHttpServletResponse();
        off.doFilter(bearer(supportToken(77L, 1L, target())), res, failingChain());
        assertThat(res.getStatus()).isEqualTo(401);
        verify(store, never()).loadForVerification(77L);
    }

    @Test
    @DisplayName("evict khi đóng phiên: lần sau đọc lại DB (không chờ hết cache 10 s)")
    void evictRereadsDatabase() throws Exception {
        SupportSessionVerifier verifier = new SupportSessionVerifier(store);
        JwtAuthFilter f = new JwtAuthFilter(jwtService, userDetailsService, sseTicketService, true, true, verifier);
        when(store.loadForVerification(77L))
                .thenReturn(Optional.of(row(null, "ADMIN", true, 9L, "STUDENT")))
                .thenReturn(Optional.of(row(Instant.now(), "ADMIN", true, 9L, "STUDENT")));
        when(userDetailsService.loadUserByUsername(TARGET_EMAIL)).thenReturn(target());
        String token = supportToken(77L, 1L, target());

        MockHttpServletResponse first = new MockHttpServletResponse();
        f.doFilter(bearer(token), first, (req, res) -> { });
        assertThat(first.getStatus()).isEqualTo(200);
        SecurityContextHolder.clearContext();

        verifier.evict(77L);
        MockHttpServletResponse second = new MockHttpServletResponse();
        f.doFilter(bearer(token), second, failingChain());
        assertThat(second.getStatus()).isEqualTo(401);
    }

    private static FilterChain failingChain() {
        return (req, res) -> {
            throw new AssertionError("chain không được chạy");
        };
    }
}
