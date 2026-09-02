package com.deutschflow.common.security;

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

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Audit F-H2 (03/09/2026): {@link JwtAuthFilter} tự dựng {@code UsernamePasswordAuthenticationToken}
 * nên KHÔNG đi qua {@code AccountStatusUserDetailsChecker} của {@code DaoAuthenticationProvider} —
 * thứ vẫn chặn tài khoản bị khóa ở đường login. Hệ quả trước bản vá: admin bấm khóa xong, người dùng
 * đó vẫn gọi API bình thường bằng access token đang cầm cho tới khi token hết hạn.
 *
 * <p>Độ trễ còn lại sau bản vá là TTL 60s của {@code userCache} trong filter — chấp nhận có chủ đích,
 * đổi lại tiết kiệm một round-trip DB mỗi request.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("JwtAuthFilter chặn tài khoản đã bị khóa")
class JwtAuthFilterDisabledUserTest {

    @Mock
    private JwtService jwtService;
    @Mock
    private UserDetailsService userDetailsService;
    @Mock
    private SseTicketService sseTicketService;
    @Mock
    private FilterChain filterChain;

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private User user(boolean active) {
        return User.builder()
                .id(7L)
                .email("locked@deutschflow.app")
                .displayName("Locked")
                .passwordHash("hash")
                .role(User.Role.STUDENT)
                .locale(User.Locale.vi)
                .active(active)
                .build();
    }

    private MockHttpServletRequest requestWithBearer() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/auth/me");
        request.addHeader("Authorization", "Bearer valid-token");
        return request;
    }

    @Test
    @DisplayName("user bị khóa: 401 và KHÔNG đi tiếp filter chain")
    void disabledUserIsRejected() throws Exception {
        JwtAuthFilter filter = new JwtAuthFilter(jwtService, userDetailsService, sseTicketService);
        when(jwtService.isTokenValid("valid-token")).thenReturn(true);
        when(jwtService.extractEmail("valid-token")).thenReturn("locked@deutschflow.app");
        when(userDetailsService.loadUserByUsername("locked@deutschflow.app")).thenReturn(user(false));

        MockHttpServletRequest request = requestWithBearer();
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, filterChain);

        assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_UNAUTHORIZED);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(filterChain, never()).doFilter(request, response);
    }

    @Test
    @DisplayName("user còn hoạt động: đặt Authentication và đi tiếp bình thường")
    void activeUserPassesThrough() throws Exception {
        JwtAuthFilter filter = new JwtAuthFilter(jwtService, userDetailsService, sseTicketService);
        when(jwtService.isTokenValid("valid-token")).thenReturn(true);
        when(jwtService.extractEmail("valid-token")).thenReturn("locked@deutschflow.app");
        when(userDetailsService.loadUserByUsername("locked@deutschflow.app")).thenReturn(user(true));

        MockHttpServletRequest request = requestWithBearer();
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, filterChain);

        assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_OK);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
        verify(filterChain).doFilter(request, response);
    }
}
