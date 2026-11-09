package com.deutschflow.user.service;

import com.deutschflow.common.security.AuthTokenAttributes;
import com.deutschflow.common.security.JwtService;
import com.deutschflow.common.transaction.RunAfterCommitService;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.user.dto.AuthResponse;
import com.deutschflow.user.dto.LoginRequest;
import com.deutschflow.user.dto.LoginResult;
import com.deutschflow.user.entity.RefreshToken;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.mfa.AdminMfaPolicy;
import com.deutschflow.user.mfa.MfaException;
import com.deutschflow.user.mfa.MfaKeyMaterial;
import com.deutschflow.user.mfa.UserMfaStore;
import com.deutschflow.user.repository.RefreshTokenRepository;
import com.deutschflow.user.repository.UserRepository;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 2FA ADMIN trong {@link AuthService} (09/11/2026): đăng nhập ADMIN trả thử thách KHÔNG token và KHÔNG thu hồi
 * phiên; mọi đường cấp token đi qua một chốt từ chối ADMIN chưa qua 2FA; refresh đòi và chép
 * {@code mfa_verified_at}; người dùng thường không đổi gì.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("AuthService — 2FA bắt buộc cho ADMIN")
class AuthServiceAdminMfaTest {

    @Mock UserRepository userRepository;
    @Mock RefreshTokenRepository refreshTokenRepository;
    @Mock UserAvatarService userAvatarService;
    @Mock JdbcTemplate jdbcTemplate;
    @Mock PasswordEncoder passwordEncoder;
    @Mock JwtService jwtService;
    @Mock AuthenticationManager authenticationManager;
    @Mock StudentTrialSubscriptionProvisioner studentTrialSubscriptionProvisioner;
    @Mock RunAfterCommitService runAfterCommitService;
    @Mock UserNotificationService userNotificationService;
    @Mock OrgMemberRepository orgMemberRepository;
    @Mock AdminMfaPolicy adminMfaPolicy;
    @Mock UserMfaStore userMfaStore;
    @Mock MfaKeyMaterial mfaKeyMaterial;

    @InjectMocks
    AuthService authService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(authService, "refreshTokenExpiryMs", 3_600_000L);
        when(adminMfaPolicy.enforced()).thenReturn(true);
        when(adminMfaPolicy.maxSessionAge()).thenReturn(Duration.ofHours(12));
        when(mfaKeyMaterial.isConfigured()).thenReturn(true);
        when(jwtService.generateMfaChallengeToken(anyLong())).thenReturn("MFA-TOKEN");
        when(jwtService.generateAccessToken(any(), any(), any())).thenReturn("ACCESS-PLAIN");
        when(jwtService.generateAccessToken(any(), any(), any(), any())).thenReturn("ACCESS-MFA");
        when(refreshTokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @AfterEach
    void clearRequest() {
        RequestContextHolder.resetRequestAttributes();
    }

    private static User admin() {
        return User.builder().id(1L).email("owner@deutschflow.app").passwordHash("h").displayName("Owner")
                .role(User.Role.ADMIN).locale(User.Locale.vi).active(true).build();
    }

    private static User student() {
        return User.builder().id(2L).email("hv@x.com").passwordHash("h").displayName("HV")
                .role(User.Role.STUDENT).locale(User.Locale.vi).active(true)
                .createdVia(User.CreatedVia.ADMIN).build();
    }

    private static RefreshToken row(User u, Instant mfaAt) {
        return RefreshToken.builder().id(9L).token("rt").user(u)
                .expiresAt(LocalDateTime.now().plusDays(1)).revoked(false).mfaVerifiedAt(mfaAt).build();
    }

    // ─── login ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("ADMIN đăng nhập đúng mật khẩu → thử thách 2FA, không token, không thu hồi phiên")
    void adminLoginReturnsChallengeWithoutTokens() {
        when(userRepository.findByEmailIgnoreCase("owner@deutschflow.app")).thenReturn(Optional.of(admin()));
        when(userMfaStore.isEnabled(1L)).thenReturn(true);

        LoginResult result = authService.login(new LoginRequest("owner@deutschflow.app", "pw"));

        assertThat(result).isInstanceOf(LoginResult.MfaChallenge.class);
        var challenge = ((LoginResult.MfaChallenge) result).challenge();
        assertThat(challenge.mfaRequired()).isTrue();
        assertThat(challenge.mfaToken()).isEqualTo("MFA-TOKEN");
        assertThat(challenge.enrolled()).isTrue();
        assertThat(challenge.emailHint()).isEqualTo("o***@deutschflow.app");
        verify(refreshTokenRepository, never()).revokeAllByUserId(anyLong());
        verify(refreshTokenRepository, never()).save(any());
        verify(jwtService, never()).generateAccessToken(any(), any(), any());
        verify(jwtService, never()).generateAccessToken(any(), any(), any(), any());
    }

    @Test
    @DisplayName("ADMIN chưa đăng ký → thử thách với enrolled=false")
    void adminNotEnrolledGetsEnrollChallenge() {
        when(userRepository.findByEmailIgnoreCase("owner@deutschflow.app")).thenReturn(Optional.of(admin()));
        when(userMfaStore.isEnabled(1L)).thenReturn(false);

        var challenge = ((LoginResult.MfaChallenge) authService.login(
                new LoginRequest("owner@deutschflow.app", "pw"))).challenge();

        assertThat(challenge.enrolled()).isFalse();
    }

    @Test
    @DisplayName("Thiếu MFA_ENCRYPTION_KEY → ADMIN nhận 503 MFA_NOT_CONFIGURED ngay ở bước mật khẩu")
    void adminLoginFailsClosedWithoutKey() {
        when(userRepository.findByEmailIgnoreCase("owner@deutschflow.app")).thenReturn(Optional.of(admin()));
        when(mfaKeyMaterial.isConfigured()).thenReturn(false);

        MfaException ex = assertThrows(MfaException.class,
                () -> authService.login(new LoginRequest("owner@deutschflow.app", "pw")));

        assertThat(ex.getCode()).isEqualTo(MfaException.MFA_NOT_CONFIGURED);
        assertThat(ex.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        verify(refreshTokenRepository, never()).revokeAllByUserId(anyLong());
    }

    @Test
    @DisplayName("Kill-switch tắt + ADMIN chưa đăng ký → đăng nhập thường (phiên không dấu 2FA)")
    void killSwitchLetsUnenrolledAdminIn() {
        when(adminMfaPolicy.enforced()).thenReturn(false);
        when(userRepository.findByEmailIgnoreCase("owner@deutschflow.app")).thenReturn(Optional.of(admin()));
        when(userMfaStore.isEnabled(1L)).thenReturn(false);

        LoginResult result = authService.login(new LoginRequest("owner@deutschflow.app", "pw"));

        assertThat(result).isInstanceOf(LoginResult.Session.class);
        assertThat(((LoginResult.Session) result).response().accessToken()).isEqualTo("ACCESS-PLAIN");
        verify(refreshTokenRepository).revokeAllByUserId(1L);
    }

    @Test
    @DisplayName("Kill-switch tắt nhưng ADMIN đã bật 2FA → vẫn phải qua 2FA")
    void killSwitchDoesNotBypassEnrolledAdmin() {
        when(adminMfaPolicy.enforced()).thenReturn(false);
        when(userRepository.findByEmailIgnoreCase("owner@deutschflow.app")).thenReturn(Optional.of(admin()));
        when(userMfaStore.isEnabled(1L)).thenReturn(true);

        assertThat(authService.login(new LoginRequest("owner@deutschflow.app", "pw")))
                .isInstanceOf(LoginResult.MfaChallenge.class);
    }

    @Test
    @DisplayName("Người dùng thường: đăng nhập y như cũ, không chạm bảng 2FA")
    void nonAdminLoginUnchanged() {
        when(userRepository.findByEmailIgnoreCase("hv@x.com")).thenReturn(Optional.of(student()));

        LoginResult result = authService.login(new LoginRequest("hv@x.com", "pw"));

        assertThat(result).isInstanceOf(LoginResult.Session.class);
        AuthResponse r = ((LoginResult.Session) result).response();
        assertThat(r.accessToken()).isEqualTo("ACCESS-PLAIN");
        assertThat(r.role()).isEqualTo("STUDENT");
        verify(refreshTokenRepository).revokeAllByUserId(2L);
        verify(userMfaStore, never()).isEnabled(anyLong());
        verify(jwtService, never()).generateMfaChallengeToken(anyLong());
    }

    // ─── chốt cấp token ──────────────────────────────────────────────────────

    @Test
    @DisplayName("completeMfaLogin: thu hồi phiên cũ, token mang dấu 2FA, dòng refresh lưu mfa_verified_at")
    void completeMfaLoginIssuesMarkedSession() {
        Instant at = Instant.now().truncatedTo(ChronoUnit.SECONDS);

        AuthResponse r = authService.completeMfaLogin(admin(), at);

        assertThat(r.accessToken()).isEqualTo("ACCESS-MFA");
        verify(refreshTokenRepository).revokeAllByUserId(1L);
        verify(jwtService).generateAccessToken(any(), any(), any(), eq(at));
        ArgumentCaptor<RefreshToken> saved = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(saved.capture());
        assertThat(saved.getValue().getMfaVerifiedAt()).isEqualTo(at);
    }

    @Test
    @DisplayName("Chốt: cấp phiên cho ADMIN không kèm trạng thái 2FA (revokeOtherSessions ngoài request) → 401 MFA_REQUIRED")
    void buildAuthResponseRefusesAdminWithoutMfa() {
        MfaException ex = assertThrows(MfaException.class, () -> authService.revokeOtherSessions(admin()));

        assertThat(ex.getCode()).isEqualTo(MfaException.MFA_REQUIRED);
        verify(jwtService, never()).generateAccessToken(any(), any(), any());
        verify(jwtService, never()).generateAccessToken(any(), any(), any(), any());
        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    @DisplayName("issueSession (lời mời trung tâm, đăng ký mã PIN) từ chối ADMIN: 403 MFA_REQUIRED_USE_LOGIN")
    void issueSessionRefusesAdmin() {
        MfaException ex = assertThrows(MfaException.class, () -> authService.issueSession(admin()));

        assertThat(ex.getCode()).isEqualTo(MfaException.MFA_REQUIRED_USE_LOGIN);
        assertThat(ex.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("issueSession cho người dùng thường vẫn cấp phiên như cũ")
    void issueSessionStudentUnchanged() {
        assertThat(authService.issueSession(student()).accessToken()).isEqualTo("ACCESS-PLAIN");
    }

    @Test
    @DisplayName("updateLocale/revokeOtherSessions giữ mfa_at GỐC từ claims của access token đang gọi")
    void carriesMfaStateFromRequestClaims() {
        Instant at = Instant.now().minus(2, ChronoUnit.HOURS).truncatedTo(ChronoUnit.SECONDS);
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setAttribute(AuthTokenAttributes.CLAIMS, Jwts.claims()
                .add(JwtService.CLAIM_MFA, true)
                .add(JwtService.CLAIM_MFA_AT, at.getEpochSecond())
                .build());
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(req));

        AuthResponse r = authService.updateLocale(admin(), "de");

        assertThat(r.accessToken()).isEqualTo("ACCESS-MFA");
        verify(jwtService).generateAccessToken(any(), any(), any(), eq(at));
        ArgumentCaptor<RefreshToken> saved = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(saved.capture());
        assertThat(saved.getValue().getMfaVerifiedAt()).isEqualTo(at);
    }

    private static void callerWithMfaAt(Instant at) {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setAttribute(AuthTokenAttributes.CLAIMS, Jwts.claims()
                .add(JwtService.CLAIM_MFA, true)
                .add(JwtService.CLAIM_MFA_AT, at.getEpochSecond())
                .build());
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(req));
    }

    @Test
    @DisplayName("updateLocale với mfa_at cũ hơn 12 giờ → 401 MFA_REQUIRED, không cấp token (không kéo dài 2FA)")
    void updateLocaleRejectsStaleMfa() {
        callerWithMfaAt(Instant.now().minus(13, ChronoUnit.HOURS));

        MfaException ex = assertThrows(MfaException.class, () -> authService.updateLocale(admin(), "de"));

        assertThat(ex.getCode()).isEqualTo(MfaException.MFA_REQUIRED);
        assertThat(ex.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(jwtService, never()).generateAccessToken(any(), any(), any(), any());
        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    @DisplayName("revokeOtherSessions với mfa_at cũ hơn 12 giờ → 401 MFA_REQUIRED, không cấp token")
    void revokeOtherSessionsRejectsStaleMfa() {
        callerWithMfaAt(Instant.now().minus(12, ChronoUnit.HOURS).minusSeconds(30));

        MfaException ex = assertThrows(MfaException.class, () -> authService.revokeOtherSessions(admin()));

        assertThat(ex.getCode()).isEqualTo(MfaException.MFA_REQUIRED);
        verify(jwtService, never()).generateAccessToken(any(), any(), any(), any());
        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    @DisplayName("revokeOtherSessions với mfa_at còn hạn → cặp token mới mang đúng mfa_at gốc")
    void revokeOtherSessionsWithFreshMfa() {
        Instant at = Instant.now().minus(11, ChronoUnit.HOURS).truncatedTo(ChronoUnit.SECONDS);
        callerWithMfaAt(at);

        AuthResponse r = authService.revokeOtherSessions(admin());

        assertThat(r.accessToken()).isEqualTo("ACCESS-MFA");
        verify(refreshTokenRepository).revokeAllByUserId(1L);
        verify(jwtService).generateAccessToken(any(), any(), any(), eq(at));
    }

    @Test
    @DisplayName("Người dùng thường không bị trần tuổi 2FA (mfa_at cũ trong claims bị bỏ qua)")
    void staleMfaIgnoredForNonAdmin() {
        callerWithMfaAt(Instant.now().minus(30, ChronoUnit.HOURS));

        assertThat(authService.updateLocale(student(), "de").accessToken()).isNotNull();
    }

    // ─── refresh ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Refresh ADMIN mà dòng không có mfa_verified_at (phiên trước deploy) → 401 MFA_REQUIRED")
    void refreshRejectsAdminWithoutMfaTimestamp() {
        when(refreshTokenRepository.findByToken("rt")).thenReturn(Optional.of(row(admin(), null)));

        MfaException ex = assertThrows(MfaException.class, () -> authService.refresh("rt"));

        assertThat(ex.getCode()).isEqualTo(MfaException.MFA_REQUIRED);
        assertThat(ex.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    @DisplayName("Refresh ADMIN có lần qua 2FA cũ hơn 12 giờ → 401 MFA_REQUIRED")
    void refreshRejectsAdminWithStaleMfa() {
        Instant old = Instant.now().minus(13, ChronoUnit.HOURS);
        when(refreshTokenRepository.findByToken("rt")).thenReturn(Optional.of(row(admin(), old)));

        MfaException ex = assertThrows(MfaException.class, () -> authService.refresh("rt"));

        assertThat(ex.getCode()).isEqualTo(MfaException.MFA_REQUIRED);
    }

    @Test
    @DisplayName("Refresh ADMIN còn trong hạn 2FA → xoay token, CHÉP nguyên mfa_verified_at sang dòng mới")
    void refreshCopiesMfaTimestamp() {
        Instant at = Instant.now().minus(1, ChronoUnit.HOURS);
        RefreshToken old = row(admin(), at);
        when(refreshTokenRepository.findByToken("rt")).thenReturn(Optional.of(old));

        AuthResponse r = authService.refresh("rt");

        assertThat(r.accessToken()).isEqualTo("ACCESS-MFA");
        assertThat(old.isRevoked()).isTrue();
        verify(jwtService).generateAccessToken(any(), any(), any(), eq(at));
        ArgumentCaptor<RefreshToken> saved = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository, org.mockito.Mockito.times(2)).save(saved.capture());
        RefreshToken fresh = saved.getAllValues().get(1);
        assertThat(fresh.getToken()).isNotEqualTo("rt");
        assertThat(fresh.getMfaVerifiedAt()).isEqualTo(at);
    }

    @Test
    @DisplayName("Refresh người dùng thường: không đòi 2FA, token không dấu 2FA")
    void refreshNonAdminUnchanged() {
        when(refreshTokenRepository.findByToken("rt")).thenReturn(Optional.of(row(student(), null)));

        AuthResponse r = authService.refresh("rt");

        assertThat(r.accessToken()).isEqualTo("ACCESS-PLAIN");
        verify(userMfaStore, never()).isEnabled(anyLong());
    }
}
