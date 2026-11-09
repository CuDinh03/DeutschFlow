package com.deutschflow.common.security;

import com.deutschflow.user.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link JwtAuthFilter} chỉ nhận token có {@code typ} hợp lệ làm credential, và SSE ticket chỉ có hiệu lực
 * trên GET tới endpoint SSE trong {@link SseTicketEndpoints}. Dùng {@link JwtService} thật (HS256) để
 * token trong test đi đúng đường ký/verify như production.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("JwtAuthFilter — phân loại token và ràng buộc SSE ticket")
class JwtAuthFilterTokenTypeTest {

    private static final String SECRET = "abcdefghijklmnopqrstuvwxyz0123456789abcdef";
    private static final String EMAIL = "hocvien@deutschflow.app";

    private final JwtService jwtService = new JwtService(SECRET, "", 3_600_000L,
            "deutschflow-api", "deutschflow-app", false, "HS256", "", "", "");

    @Mock
    private UserDetailsService userDetailsService;
    @Mock
    private SseTicketService sseTicketService;

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private JwtAuthFilter filter(boolean supportSessionEnabled) {
        return new JwtAuthFilter(jwtService, userDetailsService, sseTicketService, supportSessionEnabled);
    }

    private static User student() {
        return User.builder()
                .id(9L)
                .email(EMAIL)
                .displayName("Hoc Vien")
                .passwordHash("hash")
                .role(User.Role.STUDENT)
                .locale(User.Locale.vi)
                .active(true)
                .build();
    }

    /** Ký token tuỳ ý bằng cùng secret — mô phỏng token cũ hoặc loại token chưa có generator. */
    private static String sign(String subject, Map<String, Object> claims) {
        var builder = Jwts.builder()
                .subject(subject)
                .issuer("deutschflow-api")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60_000L));
        claims.forEach(builder::claim);
        return builder.signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
    }

    private record Result(MockHttpServletRequest request, MockHttpServletResponse response, MockFilterChain chain) {
        boolean chainCalled() {
            return chain.getRequest() != null;
        }
    }

    private Result run(JwtAuthFilter filter, MockHttpServletRequest request) throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);
        return new Result(request, response, chain);
    }

    private static MockHttpServletRequest bearer(String token) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/auth/me");
        request.addHeader("Authorization", "Bearer " + token);
        return request;
    }

    private static Authentication auth() {
        return SecurityContextHolder.getContext().getAuthentication();
    }

    @Nested
    @DisplayName("Bearer token")
    class BearerToken {

        @Test
        @DisplayName("token 2FA (typ=mfa) làm bearer → 401, không đi tiếp chain")
        void mfaTokenRejected() throws Exception {
            Result r = run(filter(false), bearer(jwtService.generateMfaChallengeToken(9L)));

            assertThat(r.response().getStatus()).isEqualTo(HttpServletResponse.SC_UNAUTHORIZED);
            assertThat(r.chainCalled()).isFalse();
            assertThat(auth()).isNull();
            verify(userDetailsService, never()).loadUserByUsername(anyString());
        }

        @Test
        @DisplayName("token 2FA không lọt dù sub bị đổi thành email (typ vẫn là mfa)")
        void mfaTypWithEmailSubjectRejected() throws Exception {
            Result r = run(filter(false), bearer(sign(EMAIL, Map.of("typ", "mfa", "role", "ADMIN"))));

            assertThat(r.response().getStatus()).isEqualTo(HttpServletResponse.SC_UNAUTHORIZED);
            assertThat(auth()).isNull();
        }

        @Test
        @DisplayName("loại token lạ → 401")
        void unknownTypRejected() throws Exception {
            Result r = run(filter(false), bearer(sign(EMAIL, Map.of("typ", "refresh"))));

            assertThat(r.response().getStatus()).isEqualTo(HttpServletResponse.SC_UNAUTHORIZED);
            assertThat(r.chainCalled()).isFalse();
            assertThat(auth()).isNull();
        }

        @Test
        @DisplayName("token cũ KHÔNG có typ (production trước bản này) → vẫn xác thực")
        void legacyUntypedTokenAuthenticated() throws Exception {
            when(userDetailsService.loadUserByUsername(EMAIL)).thenReturn(student());

            Result r = run(filter(false), bearer(sign(EMAIL, Map.of("role", "STUDENT", "userId", 9L))));

            assertThat(r.response().getStatus()).isEqualTo(HttpServletResponse.SC_OK);
            assertThat(r.chainCalled()).isTrue();
            assertThat(auth()).isNotNull();
            assertThat(auth().getPrincipal()).isInstanceOf(User.class);
            assertThat(r.request().getAttribute(AuthTokenAttributes.TOKEN_TYPE)).isEqualTo(JwtService.TYP_ACCESS);
        }

        @Test
        @DisplayName("access token mới (typ=access) → xác thực, claims nằm trong request attribute")
        void typedAccessTokenAuthenticated() throws Exception {
            when(userDetailsService.loadUserByUsername(EMAIL)).thenReturn(student());

            Result r = run(filter(false), bearer(jwtService.generateAccessToken(student())));

            assertThat(r.chainCalled()).isTrue();
            assertThat(auth()).isNotNull();
            Object claims = r.request().getAttribute(AuthTokenAttributes.CLAIMS);
            assertThat(claims).isInstanceOf(Claims.class);
            assertThat(((Claims) claims).getSubject()).isEqualTo(EMAIL);
            assertThat(((Claims) claims).getId()).isNotBlank();
            assertThat(r.request().getAttribute(AuthTokenAttributes.TOKEN_TYPE)).isEqualTo(JwtService.TYP_ACCESS);
        }

        @Test
        @DisplayName("token support khi cờ TẮT (mặc định) → 401")
        void supportTokenRejectedWhileFlagOff() throws Exception {
            Result r = run(filter(false), bearer(sign(EMAIL, Map.of("typ", "support", "role", "STUDENT"))));

            assertThat(r.response().getStatus()).isEqualTo(HttpServletResponse.SC_UNAUTHORIZED);
            assertThat(r.chainCalled()).isFalse();
            assertThat(auth()).isNull();
            verify(userDetailsService, never()).loadUserByUsername(anyString());
        }

        @Test
        @DisplayName("token support khi cờ BẬT → qua kiểm loại, request mang TOKEN_TYPE=support cho filter sau")
        void supportTokenPassesTypeCheckWhenFlagOn() throws Exception {
            when(userDetailsService.loadUserByUsername(EMAIL)).thenReturn(student());

            Result r = run(filter(true), bearer(sign(EMAIL, Map.of("typ", "support", "role", "STUDENT"))));

            assertThat(r.chainCalled()).isTrue();
            assertThat(auth()).isNotNull();
            assertThat(r.request().getAttribute(AuthTokenAttributes.TOKEN_TYPE)).isEqualTo(JwtService.TYP_SUPPORT);
        }

        @Test
        @DisplayName("token hết hạn/sai chữ ký → như trước: không xác thực nhưng vẫn đi tiếp chain")
        void invalidTokenPassesThroughUnauthenticated() throws Exception {
            Result r = run(filter(false), bearer("khong-phai-jwt"));

            assertThat(r.response().getStatus()).isEqualTo(HttpServletResponse.SC_OK);
            assertThat(r.chainCalled()).isTrue();
            assertThat(auth()).isNull();
        }
    }

    @Nested
    @DisplayName("Token khách (guest:)")
    class GuestToken {

        private static boolean hasGuestRole() {
            return auth().getAuthorities().stream()
                    .map(GrantedAuthority::getAuthority)
                    .anyMatch("ROLE_GUEST"::equals);
        }

        @Test
        @DisplayName("guest token mới (typ=guest) → ROLE_GUEST, pinCode vào attribute")
        void typedGuestToken() throws Exception {
            Result r = run(filter(false), bearer(jwtService.generateGuestToken("nick", "123456", 60_000L)));

            assertThat(r.chainCalled()).isTrue();
            assertThat(hasGuestRole()).isTrue();
            assertThat(r.request().getAttribute("guestPinCode")).isEqualTo("123456");
            verify(userDetailsService, never()).loadUserByUsername(anyString());
        }

        @Test
        @DisplayName("guest token cũ không typ → vẫn là khách")
        void legacyGuestToken() throws Exception {
            Result r = run(filter(false), bearer(sign("guest:nick", Map.of("role", "GUEST", "pinCode", "1"))));

            assertThat(r.chainCalled()).isTrue();
            assertThat(hasGuestRole()).isTrue();
        }

        @Test
        @DisplayName("subject guest: mà typ=access → 401")
        void guestSubjectWithAccessTypRejected() throws Exception {
            Result r = run(filter(false), bearer(sign("guest:nick", Map.of("typ", "access", "role", "GUEST"))));

            assertThat(r.response().getStatus()).isEqualTo(HttpServletResponse.SC_UNAUTHORIZED);
            assertThat(auth()).isNull();
        }

        @Test
        @DisplayName("subject guest: mà typ=mfa → 401")
        void guestSubjectWithMfaTypRejected() throws Exception {
            Result r = run(filter(false), bearer(sign("guest:nick", Map.of("typ", "mfa"))));

            assertThat(r.response().getStatus()).isEqualTo(HttpServletResponse.SC_UNAUTHORIZED);
            assertThat(auth()).isNull();
        }

        @Test
        @DisplayName("typ=guest nhưng subject là email → 401 (không leo thành người dùng đăng ký)")
        void guestTypWithEmailSubjectRejected() throws Exception {
            Result r = run(filter(false), bearer(sign(EMAIL, Map.of("typ", "guest"))));

            assertThat(r.response().getStatus()).isEqualTo(HttpServletResponse.SC_UNAUTHORIZED);
            assertThat(auth()).isNull();
            verify(userDetailsService, never()).loadUserByUsername(anyString());
        }
    }

    @Nested
    @DisplayName("SSE ticket")
    class SseTicket {

        private MockHttpServletRequest withTicket(String method, String uri) {
            MockHttpServletRequest request = new MockHttpServletRequest(method, uri);
            request.setParameter("ticket", "t-123");
            return request;
        }

        @Test
        @DisplayName("GET /api/notifications/stream?ticket= → xác thực từ ticket")
        void ticketOnSseGetAuthenticates() throws Exception {
            when(sseTicketService.consume("t-123")).thenReturn(Optional.of(EMAIL));
            when(userDetailsService.loadUserByUsername(EMAIL)).thenReturn(student());

            Result r = run(filter(false), withTicket("GET", "/api/notifications/stream"));

            assertThat(r.chainCalled()).isTrue();
            assertThat(auth()).isNotNull();
        }

        @Test
        @DisplayName("GET /api/jobs/{id}/sse?ticket= → xác thực từ ticket")
        void ticketOnJobSseAuthenticates() throws Exception {
            when(sseTicketService.consume("t-123")).thenReturn(Optional.of(EMAIL));
            when(userDetailsService.loadUserByUsername(EMAIL)).thenReturn(student());

            run(filter(false), withTicket("GET", "/api/jobs/42/sse"));

            assertThat(auth()).isNotNull();
        }

        @Test
        @DisplayName("POST tới endpoint SSE kèm ?ticket= → bỏ qua ticket, không xác thực, không tiêu thụ")
        void ticketOnPostIgnored() throws Exception {
            Result r = run(filter(false), withTicket("POST", "/api/notifications/stream"));

            assertThat(r.chainCalled()).isTrue();
            assertThat(auth()).isNull();
            verify(sseTicketService, never()).consume(anyString());
        }

        @Test
        @DisplayName("GET tới đường dẫn không phải SSE kèm ?ticket= → bỏ qua ticket")
        void ticketOnNonSsePathIgnored() throws Exception {
            Result r = run(filter(false), withTicket("GET", "/api/auth/me"));

            assertThat(r.chainCalled()).isTrue();
            assertThat(auth()).isNull();
            verify(sseTicketService, never()).consume(anyString());
        }

        @Test
        @DisplayName("POST ghi (đọc hết thông báo) kèm ?ticket= → bỏ qua ticket")
        void ticketOnWriteEndpointIgnored() throws Exception {
            run(filter(false), withTicket("POST", "/api/notifications/read-all"));

            assertThat(auth()).isNull();
            verify(sseTicketService, never()).consume(anyString());
        }

        @Test
        @DisplayName("GET /api/jobs/{id}/status kèm ?ticket= → bỏ qua (cùng tiền tố nhưng không phải SSE)")
        void ticketOnSiblingNonSseJobPathIgnored() throws Exception {
            run(filter(false), withTicket("GET", "/api/jobs/42/status"));

            assertThat(auth()).isNull();
            verify(sseTicketService, never()).consume(anyString());
        }
    }
}
