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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceRefreshTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtService jwtService;
    @Mock
    private AuthenticationManager authenticationManager;

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
        when(jwtService.generateAccessToken(user)).thenReturn("new-access");
        when(refreshTokenRepository.save(any(RefreshToken.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        AuthResponse response = authService.refresh(new RefreshRequest("old-token"));

        assertTrue(oldToken.isRevoked(), "old token should be revoked");
        assertNotEquals("old-token", response.refreshToken(), "new refresh token should be rotated");
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

        assertThrows(BadRequestException.class, () -> authService.refresh(new RefreshRequest("revoked-token")));
    }
}
