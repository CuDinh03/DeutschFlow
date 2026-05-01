package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.security.JwtService;
import com.deutschflow.user.dto.AuthResponse;
import com.deutschflow.user.dto.LoginRequest;
import com.deutschflow.user.dto.RefreshRequest;
import com.deutschflow.user.dto.RegisterRequest;
import com.deutschflow.user.entity.RefreshToken;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.RefreshTokenRepository;
import com.deutschflow.user.repository.UserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final StudentTrialSubscriptionProvisioner studentTrialSubscriptionProvisioner;

    @Value("${app.jwt.refresh-token-expiry-ms}")
    private long refreshTokenExpiryMs;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new BadRequestException("Email already in use");
        }

        // locale đã được validate bởi @Pattern trong DTO, default về vi nếu null
        User.Locale locale = (request.locale() != null)
                ? User.Locale.valueOf(request.locale())
                : User.Locale.vi;

        var user = User.builder()
                .email(request.email())
                .passwordHash(passwordEncoder.encode(request.password()))
                .displayName(request.displayName())
                .role(User.Role.STUDENT)
                .locale(locale)
                .build();

        userRepository.save(user);
        Instant start = Instant.now();
        studentTrialSubscriptionProvisioner.provisionSevenDayTrial(
                user.getId(), start, start.plus(Duration.ofDays(7)));
        return buildAuthResponse(user);
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.email(), request.password()));
        } catch (BadCredentialsException e) {
            throw new BadRequestException("Invalid email or password");
        }

        var user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new BadRequestException("Invalid email or password"));

        if (user.getRole() == User.Role.STUDENT) {
            Integer subCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM user_subscriptions WHERE user_id = ?",
                    Integer.class, user.getId());
            if (subCount != null && subCount == 0) {
                Instant start = Instant.now();
                studentTrialSubscriptionProvisioner.provisionSevenDayTrial(
                        user.getId(), start, start.plus(Duration.ofDays(7)));
            }
        }

        refreshTokenRepository.revokeAllByUserId(user.getId());
        return buildAuthResponse(user);
    }

    @Transactional
    public AuthResponse refresh(RefreshRequest request) {
        var stored = refreshTokenRepository.findByToken(request.refreshToken())
                .orElseThrow(() -> new BadRequestException("Invalid refresh token"));

        if (stored.isRevoked() || stored.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Refresh token expired or revoked");
        }

        stored.setRevoked(true);
        refreshTokenRepository.save(stored);

        return buildAuthResponse(stored.getUser());
    }

    @Transactional
    public void logout(Long userId) {
        refreshTokenRepository.revokeAllByUserId(userId);
    }

    @Transactional
    public AuthResponse updateLocale(User user, String locale) {
        User.Locale loc = User.Locale.valueOf(locale.trim().toLowerCase());
        user.setLocale(loc);
        userRepository.save(user);
        return buildAuthResponse(user);
    }

    // --- private ---

    private AuthResponse buildAuthResponse(User user) {
        String accessToken  = jwtService.generateAccessToken(user);
        String refreshToken = createRefreshToken(user);
        return new AuthResponse(
                accessToken,
                refreshToken,
                user.getId(),
                user.getEmail(),
                user.getDisplayName(),
                user.getRole().name(),
                user.getLocale().name()
        );
    }

    private String createRefreshToken(User user) {
        String token = UUID.randomUUID().toString();
        var rt = RefreshToken.builder()
                .user(user)
                .token(token)
                .expiresAt(LocalDateTime.now().plusSeconds(refreshTokenExpiryMs / 1000))
                .build();
        refreshTokenRepository.save(rt);
        return token;
    }
}
