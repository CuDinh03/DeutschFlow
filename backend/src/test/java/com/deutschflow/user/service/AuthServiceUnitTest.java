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
        when(userRepository.existsByEmailIgnoreCase("dup@x.com")).thenReturn(true);
        var req = new RegisterRequest("dup@x.com", "0912345678", RAW_PASSWORD, "Name", "vi");
        assertThrows(BadRequestException.class, () -> authService.register(req));
        verify(userRepository, never()).save(any());
    }

    @Test
    void register_normalizesMixedCaseEmailToLowercase() {
        when(userRepository.existsByEmailIgnoreCase("new@x.com")).thenReturn(false);
        when(passwordEncoder.encode(RAW_PASSWORD)).thenReturn("HASH");
        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        when(userRepository.save(saved.capture())).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(1L);
            return u;
        });
        when(jwtService.generateAccessToken(any(), any(), any())).thenReturn("ACCESS");
        when(refreshTokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Mixed case + stray spaces — must be stored canonical so the case-insensitive login finds it.
        var req = new RegisterRequest("  New@X.Com ", "0912345678", RAW_PASSWORD, "Name", "vi");
        authService.register(req);

        assertEquals("new@x.com", saved.getValue().getEmail());
    }

    @Test
    void register_rejectsCaseVariantDuplicate() {
        // foo@x.com already exists; creating FOO@X.com must be blocked (case-insensitive uniqueness).
        when(userRepository.existsByEmailIgnoreCase("foo@x.com")).thenReturn(true);
        var req = new RegisterRequest("FOO@X.com", "0912345678", RAW_PASSWORD, "Name", "vi");
        assertThrows(BadRequestException.class, () -> authService.register(req));
        verify(userRepository, never()).save(any());
    }

    @Test
    void register_blankPhone_storedAsNull_andSkipsUniquenessCheck() {
        when(userRepository.existsByEmailIgnoreCase("new@x.com")).thenReturn(false);
        when(passwordEncoder.encode(RAW_PASSWORD)).thenReturn("HASH");
        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        when(userRepository.save(saved.capture())).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(1L);
            return u;
        });
        when(jwtService.generateAccessToken(any(), any(), any())).thenReturn("ACCESS");
        when(refreshTokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Phone is optional at sign-up (App Store 5.1.1(v)). A blank value must persist as NULL — not
        // "" — because phone_number is UNIQUE and Postgres allows many NULLs but only one empty string,
        // so a second no-phone account would otherwise collide. The uniqueness lookup is also skipped.
        var req = new RegisterRequest("new@x.com", "   ", RAW_PASSWORD, "Name", "vi");
        authService.register(req);

        assertNull(saved.getValue().getPhoneNumber());
        verify(userRepository, never()).existsByPhoneNumber(anyString());
    }

    @Test
    void register_nullPhone_storedAsNull() {
        when(userRepository.existsByEmailIgnoreCase("new@x.com")).thenReturn(false);
        when(passwordEncoder.encode(RAW_PASSWORD)).thenReturn("HASH");
        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        when(userRepository.save(saved.capture())).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(2L);
            return u;
        });
        when(jwtService.generateAccessToken(any(), any(), any())).thenReturn("ACCESS");
        when(refreshTokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var req = new RegisterRequest("new@x.com", null, RAW_PASSWORD, "Name", "vi");
        authService.register(req);

        assertNull(saved.getValue().getPhoneNumber());
        verify(userRepository, never()).existsByPhoneNumber(anyString());
    }

    @Test
    void register_withPhone_trimsAndChecksUniqueness() {
        when(userRepository.existsByEmailIgnoreCase("new@x.com")).thenReturn(false);
        when(userRepository.existsByPhoneNumber("0912345678")).thenReturn(false);
        when(passwordEncoder.encode(RAW_PASSWORD)).thenReturn("HASH");
        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        when(userRepository.save(saved.capture())).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(3L);
            return u;
        });
        when(jwtService.generateAccessToken(any(), any(), any())).thenReturn("ACCESS");
        when(refreshTokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // A provided number is trimmed, checked for uniqueness, and stored as-is.
        var req = new RegisterRequest("new@x.com", "  0912345678 ", RAW_PASSWORD, "Name", "vi");
        authService.register(req);

        assertEquals("0912345678", saved.getValue().getPhoneNumber());
        verify(userRepository).existsByPhoneNumber("0912345678");
    }

    @Test
    void register_persistsStudentAndNotifiesAfterCommit() {
        when(userRepository.existsByEmailIgnoreCase("new@x.com")).thenReturn(false);
        when(passwordEncoder.encode(RAW_PASSWORD)).thenReturn("HASH");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(42L);
            return u;
        });
        when(jwtService.generateAccessToken(any(), any(), any())).thenReturn("ACCESS");
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
    void login_trimsEmailAndLooksUpCaseInsensitively() {
        // The reported bug: stored email is lowercase but the user typed a leading space + capital
        // letter (mobile auto-capitalize). The lookup must still resolve, so login trims and the repo
        // matches case-insensitively — otherwise the row is missed and surfaces as "wrong password".
        User u = User.builder()
                .id(3L).email("user@x.com").passwordHash("HASH")
                .displayName("U").role(User.Role.TEACHER).locale(User.Locale.vi)
                .build();
        when(userRepository.findByEmailIgnoreCase("User@X.com")).thenReturn(Optional.of(u));
        when(jwtService.generateAccessToken(any(), any(), any())).thenReturn("ACCESS");
        when(refreshTokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var req = new LoginRequest("  User@X.com  ", RAW_PASSWORD);
        var res = authService.login(req);

        assertEquals("ACCESS", res.accessToken());
        // authenticate() receives the trimmed email (not the raw spaced value).
        ArgumentCaptor<UsernamePasswordAuthenticationToken> tok =
                ArgumentCaptor.forClass(UsernamePasswordAuthenticationToken.class);
        verify(authenticationManager).authenticate(tok.capture());
        assertEquals("User@X.com", tok.getValue().getPrincipal());
        // The post-auth lookup is case-insensitive on the trimmed value.
        verify(userRepository).findByEmailIgnoreCase("User@X.com");
        verify(userRepository, never()).findByEmail(anyString());
        verify(refreshTokenRepository).revokeAllByUserId(3L);
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

    /**
     * RCA for "ERR-161": login's catch only handles {@link BadCredentialsException}. When the Hikari
     * pool is exhausted (or Postgres is unreachable), {@code authenticate()} loads the user from the DB
     * and fails with {@link org.springframework.jdbc.CannotGetJdbcConnectionException} after the 5s
     * connection-timeout. That is NOT caught → it propagates to the advice. PRE-FIX it surfaced as the
     * masked 500 "ERR-xxx" (the incident); it is now mapped to a retryable 503 by
     * {@code GlobalExceptionHandler.handleDbUnavailable}. Contrast with
     * {@link #login_mapsBadCredentialsToBadRequest} (a real auth failure → 400).
     */
    @Test
    void login_dbConnectionFailure_propagatesUncaught_notMaskedAsBadRequest() {
        LoginRequest req = new LoginRequest("a@b.com", RAW_PASSWORD);
        var dbDown = new org.springframework.jdbc.CannotGetJdbcConnectionException(
                "Failed to obtain JDBC Connection",
                new java.sql.SQLTransientConnectionException(
                        "HikariPool-1 - Connection is not available, request timed out after 5000ms"));
        doThrow(dbDown).when(authenticationManager)
                .authenticate(any(UsernamePasswordAuthenticationToken.class));

        // The infra failure must NOT be swallowed/mis-classified as a 400 bad-request; it bubbles up
        // (→ becomes the masked 500 / ERR-xxx at the controller-advice boundary).
        assertThrows(org.springframework.jdbc.CannotGetJdbcConnectionException.class,
                () -> authService.login(req));
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
        // refresh() now takes String token directly (not RefreshRequest)
        assertThrows(BadRequestException.class, () -> authService.refresh("tok"));
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

    @Test
    void savePushToken_storesValidExpoToken() {
        User u = User.builder()
                .id(5L).email("a@b.com").passwordHash("x").displayName("A").role(User.Role.STUDENT)
                .build();

        authService.savePushToken(u, "ExponentPushToken[abc123]", "ios");

        assertEquals("ExponentPushToken[abc123]", u.getPushToken());
        assertEquals("ios", u.getPushPlatform());
        verify(userRepository).save(u);
    }

    @Test
    void savePushToken_ignoresRawApnsToken() {
        User u = User.builder()
                .id(5L).email("a@b.com").passwordHash("x").displayName("A").role(User.Role.STUDENT)
                .build();

        // Raw 64-hex APNs token from the legacy Capacitor build — backend is Expo-only, so it must not be stored.
        authService.savePushToken(u, "740f4707bebcf74f9b7c25d48e3358945f6aa01da5ddb387462c7eaf61bb78ad", "ios");

        assertNull(u.getPushToken());
        verify(userRepository, never()).save(any());
    }
}
