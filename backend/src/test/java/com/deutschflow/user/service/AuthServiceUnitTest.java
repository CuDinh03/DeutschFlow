package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.security.JwtService;
import com.deutschflow.common.transaction.RunAfterCommitService;
import com.deutschflow.notification.events.StudentRegisteredEvent;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.user.dto.LoginRequest;
import com.deutschflow.user.dto.RefreshRequest;
import com.deutschflow.user.dto.RegisterRequest;
import com.deutschflow.user.entity.RefreshToken;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.RefreshTokenRepository;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceUnitTest {

    private static final String RAW_PASSWORD = "secret12";

    @Mock
    UserRepository userRepository;
    @Mock
    RefreshTokenRepository refreshTokenRepository;
    @Mock
    JdbcTemplate jdbcTemplate;
    @Mock
    PasswordEncoder passwordEncoder;
    @Mock
    JwtService jwtService;
    @Mock
    AuthenticationManager authenticationManager;
    @Mock
    StudentTrialSubscriptionProvisioner studentTrialSubscriptionProvisioner;
    @Mock
    RunAfterCommitService runAfterCommitService;
    @Mock
    UserNotificationService userNotificationService;

    @InjectMocks
    AuthService authService;

    @BeforeEach
    void wireRefreshExpiry() {
        ReflectionTestUtils.setField(authService, "refreshTokenExpiryMs", 3_600_000L);
    }

    @Test
    void register_throwsWhenEmailAlreadyExists() {
        when(userRepository.existsByEmail("dup@x.com")).thenReturn(true);
        var req = new RegisterRequest("dup@x.com", "0912345678", RAW_PASSWORD, "Name", "vi");
        assertThrows(BadRequestException.class, () -> authService.register(req));
        verify(userRepository, never()).save(any());
    }

    @Test
    void register_persistsStudentAndNotifiesAfterCommit() {
        when(userRepository.existsByEmail("new@x.com")).thenReturn(false);
        when(passwordEncoder.encode(RAW_PASSWORD)).thenReturn("HASH");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(42L);
            return u;
        });
        when(jwtService.generateAccessToken(any())).thenReturn("ACCESS");
        when(refreshTokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ArgumentCaptor<Runnable> after = ArgumentCaptor.forClass(Runnable.class);
        doNothing().when(runAfterCommitService).run(after.capture());

        var req = new RegisterRequest("new@x.com", "0987654321", RAW_PASSWORD, "Learner", "vi");
        var res = authService.register(req);

        assertEquals("ACCESS", res.accessToken());
        verify(studentTrialSubscriptionProvisioner).provisionSevenDayTrial(eq(42L), any(), any());
        verify(runAfterCommitService).run(any());
        after.getValue().run();
        verify(userNotificationService).onStudentRegisteredAfterCommit(any(StudentRegisteredEvent.class));
    }

    @Test
    void login_mapsBadCredentialsToBadRequest() {
        LoginRequest req = new LoginRequest("a@b.com", "wrong");
        doThrow(new BadCredentialsException("bad"))
                .when(authenticationManager)
                .authenticate(any(UsernamePasswordAuthenticationToken.class));
        assertThrows(BadRequestException.class, () -> authService.login(req));
        verify(refreshTokenRepository, never()).revokeAllByUserId(anyLong());
    }

    @Test
    void refresh_throwsWhenTokenExpired() {
        User u = User.builder()
                .id(1L)
                .email("a@b.com")
                .passwordHash("x")
                .displayName("x")
                .role(User.Role.STUDENT)
                .build();
        RefreshToken rt = RefreshToken.builder()
                .user(u)
                .token("tok")
                .expiresAt(LocalDateTime.now().minusHours(1))
                .revoked(false)
                .build();
        when(refreshTokenRepository.findByToken("tok")).thenReturn(Optional.of(rt));
        assertThrows(BadRequestException.class, () -> authService.refresh(new RefreshRequest("tok")));
        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    void me_student_readsTargetLevelFromJdbc() {
        User u = User.builder()
                .id(7L)
                .email("s@b.com")
                .passwordHash("x")
                .displayName("S")
                .role(User.Role.STUDENT)
                .build();
        when(jdbcTemplate.queryForList(anyString(), any(Object[].class)))
                .thenReturn(List.of(java.util.Map.of("target_level", "B1", "industry", "IT")));
        var res = authService.me(u);
        assertEquals("B1", res.learningTargetLevel());
    }

    @Test
    void me_teacher_skipsProfileQuery() {
        User u = User.builder()
                .id(9L)
                .email("t@b.com")
                .passwordHash("x")
                .displayName("T")
                .role(User.Role.TEACHER)
                .build();
        var res = authService.me(u);
        assertNull(res.learningTargetLevel());
        verifyNoInteractions(jdbcTemplate);
    }
}
