package com.deutschflow.security;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.security.JwtService;
import com.deutschflow.user.dto.AuthResponse;
import com.deutschflow.user.dto.RefreshRequest;
import com.deutschflow.user.entity.RefreshToken;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.RefreshTokenRepository;
import com.deutschflow.user.repository.UserRepository;
import com.deutschflow.user.service.AuthService;
import com.deutschflow.user.service.StudentTrialSubscriptionProvisioner;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceRefreshTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;
    @Mock
    private JdbcTemplate jdbcTemplate;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtService jwtService;
    @Mock
    private AuthenticationManager authenticationManager;
    @Mock
    private StudentTrialSubscriptionProvisioner studentTrialSubscriptionProvisioner;

    @InjectMocks
    private AuthService authService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(authService, "refreshTokenExpiryMs", 604800000L);
    }

    @Test
    void refreshShouldRotateTokenAndRevokeOldToken() {
        User user = User.builder()
                .id(100L)
                .email("student@deutschflow.app")
                .displayName("Student")
                .passwordHash("hash")
                .role(User.Role.STUDENT)
                .locale(User.Locale.vi)
                .build();
        RefreshToken oldToken = RefreshToken.builder()
                .id(1L)
                .token("old-token")
                .user(user)
                .expiresAt(LocalDateTime.now().plusDays(1))
                .revoked(false)
                .build();

        when(refreshTokenRepository.findByToken("old-token")).thenReturn(Optional.of(oldToken));
        when(jwtService.generateAccessToken(any(), any(), any())).thenReturn("new-access");
        when(refreshTokenRepository.save(any(RefreshToken.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        // refresh() now takes String token directly (not RefreshRequest)
        AuthResponse response = authService.refresh("old-token");

        assertTrue(oldToken.isRevoked(), "old token should be revoked");
        assertNotEquals("old-token", response.refreshToken(), "new refresh token should be rotated");
    }

    /**
     * Audit F-H2 (03/09/2026): login chặn tài khoản bị khóa qua {@code User#isEnabled}
     * (DaoAuthenticationProvider), nhưng refresh thì không kiểm gì — nên tài khoản bị admin khóa
     * vẫn tự gia hạn phiên tới hết vòng đời refresh token (7 ngày). Đây là ca chặn điều đó.
     */
    @Test
    void refreshShouldFailWhenUserDeactivated() {
        User user = User.builder()
                .id(100L)
                .email("locked@deutschflow.app")
                .displayName("Locked")
                .passwordHash("hash")
                .role(User.Role.STUDENT)
                .locale(User.Locale.vi)
                .active(false)
                .build();
        RefreshToken liveToken = RefreshToken.builder()
                .id(1L)
                .token("live-token")
                .user(user)
                .expiresAt(LocalDateTime.now().plusDays(1))
                .revoked(false)
                .build();

        when(refreshTokenRepository.findByToken("live-token")).thenReturn(Optional.of(liveToken));

        assertThrows(BadRequestException.class, () -> authService.refresh("live-token"));
        // Chặn thôi chưa đủ: revoke nốt phần còn lại để không thử tiếp bằng token khác cùng tài khoản.
        verify(refreshTokenRepository).revokeAllByUserId(100L);
    }

    @Test
    void refreshShouldFailWhenTokenRevoked() {
        User user = User.builder()
                .id(100L)
                .email("student@deutschflow.app")
                .displayName("Student")
                .passwordHash("hash")
                .role(User.Role.STUDENT)
                .locale(User.Locale.vi)
                .build();
        RefreshToken revokedToken = RefreshToken.builder()
                .id(1L)
                .token("revoked-token")
                .user(user)
                .expiresAt(LocalDateTime.now().plusDays(1))
                .revoked(true)
                .build();

        when(refreshTokenRepository.findByToken("revoked-token")).thenReturn(Optional.of(revokedToken));

        // refresh() now takes String token directly (not RefreshRequest)
        assertThrows(BadRequestException.class, () -> authService.refresh("revoked-token"));
    }
}
