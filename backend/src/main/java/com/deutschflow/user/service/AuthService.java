package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.transaction.RunAfterCommitService;
import com.deutschflow.common.security.JwtService;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.user.dto.AuthResponse;
import com.deutschflow.user.dto.ChangePasswordRequest;
import com.deutschflow.user.dto.LoginRequest;
import com.deutschflow.user.dto.RegisterRequest;
import com.deutschflow.user.dto.UpdateProfileRequest;
import com.deutschflow.user.entity.RefreshToken;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.RefreshTokenRepository;
import com.deutschflow.user.repository.UserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import com.deutschflow.notification.events.StudentRegisteredEvent;
import com.deutschflow.notification.service.ExpoPushSenderService;
import com.deutschflow.notification.service.UserNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
import java.util.List;
import java.util.UUID;

@Slf4j
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
    private final RunAfterCommitService runAfterCommitService;
    private final UserNotificationService userNotificationService;
    private final OrgMemberRepository orgMemberRepository;

    @Value("${app.jwt.refresh-token-expiry-ms}")
    private long refreshTokenExpiryMs;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        // Normalize to canonical lowercase + trimmed, matching admin createUser. Keeps stored emails
        // consistent so the case-insensitive login lookup always resolves, and the IgnoreCase
        // existence check blocks creating a case-variant duplicate (Foo@x.com vs foo@x.com).
        String email = request.email() == null ? "" : request.email().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new BadRequestException("Email này đã được đăng ký, vui lòng dùng email khác.");
        }
        // Phone is optional (App Store 5.1.1(v)). Store NULL — not "" — when omitted: the column is
        // UNIQUE, and Postgres permits many NULLs but only one empty string, so a second no-phone
        // signup would otherwise collide. Uniqueness is only checked when a real number is given.
        String phoneNumber = (request.phoneNumber() == null || request.phoneNumber().isBlank())
                ? null
                : request.phoneNumber().trim();
        if (phoneNumber != null && userRepository.existsByPhoneNumber(phoneNumber)) {
            throw new BadRequestException("Số điện thoại này đã được đăng ký, vui lòng dùng số khác.");
        }

        // locale đã được validate bởi @Pattern trong DTO, default về vi nếu null
        User.Locale locale = (request.locale() != null)
                ? User.Locale.valueOf(request.locale())
                : User.Locale.vi;

        var user = User.builder()
                .email(email)
                .phoneNumber(phoneNumber)
                .passwordHash(passwordEncoder.encode(request.password()))
                .displayName(request.displayName())
                .role(User.Role.STUDENT)
                .locale(locale)
                .createdVia(User.CreatedVia.SELF)
                .build();

        userRepository.save(user);
        Instant start = Instant.now();
        studentTrialSubscriptionProvisioner.provisionSevenDayTrial(
                user.getId(), start, start.plus(Duration.ofDays(7)));

        StudentRegisteredEvent registered = new StudentRegisteredEvent(
                user.getId(), user.getEmail(), user.getDisplayName());
        runAfterCommitService.run(() -> userNotificationService.onStudentRegisteredAfterCommit(registered));

        return buildAuthResponse(user);
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        // Trim the submitted email; the actual match is case-insensitive (UserDetailsServiceConfig +
        // findByEmailIgnoreCase). Without this, a stray space or a single capital letter made login
        // fail as "wrong password" even when the password was correct (the lookup just missed the row).
        String email = request.email() == null ? "" : request.email().trim();
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, request.password()));
        } catch (BadCredentialsException e) {
            throw new BadRequestException("Invalid email or password");
        }

        var user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new BadRequestException("Invalid email or password"));

        if (user.getRole() == User.Role.STUDENT) {
            Integer subCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM user_subscriptions WHERE user_id = ?",
                    Integer.class, user.getId());
            if (subCount != null && subCount == 0) {
                try {
                    Instant start = Instant.now();
                    studentTrialSubscriptionProvisioner.provisionSevenDayTrial(
                            user.getId(), start, start.plus(Duration.ofDays(7)));
                } catch (Exception e) {
                    log.warn("Failed to provision trial subscription for user {}: {}", user.getId(), e.getMessage());
                    // User can still login — subscription creation can fail without blocking auth
                }
            }
        }

        refreshTokenRepository.revokeAllByUserId(user.getId());
        return buildAuthResponse(user);
    }

    @Transactional
    public AuthResponse refresh(String token) {
        var stored = refreshTokenRepository.findByToken(token)
                .orElseThrow(() -> new BadRequestException("Invalid refresh token"));

        // 🚨 Token đã revoke mà vẫn bị trình ra = dấu hiệu theft (kẻ trộm & nạn nhân cùng giữ chuỗi token).
        // Revoke toàn bộ session để buộc đăng nhập lại trên mọi thiết bị.
        if (stored.isRevoked()) {
            refreshTokenRepository.revokeAllByUserId(stored.getUser().getId());
            // Theft signal: kill the device push token too so the compromised session cannot keep
            // receiving this account's notifications (the legit device re-registers on next login).
            userRepository.clearPushToken(stored.getUser().getId());
            log.warn("[AuthService] Refresh token reuse detected for userId={} — all sessions revoked",
                     stored.getUser().getId());
            throw new BadRequestException("Session compromised. Please log in again.");
        }

        if (stored.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Refresh token expired");
        }

        stored.setRevoked(true);
        refreshTokenRepository.save(stored);

        return buildAuthResponse(stored.getUser());
    }

    @Transactional
    public void logout(Long userId) {
        refreshTokenRepository.revokeAllByUserId(userId);
        // Logout revokes EVERY session for this account, so its device push token must go too —
        // otherwise the phone keeps receiving this account's notifications after logout (worst
        // case: shown to whoever logs in next on that device).
        userRepository.clearPushToken(userId);
    }

    @Transactional
    public void savePushToken(User user, String token, String platform) {
        // Delivery is Expo-only (see ExpoPushSenderService). Ignore raw APNs/FCM tokens — e.g. from the
        // legacy Capacitor build — so they never clobber a valid Expo token in users.push_token.
        if (!ExpoPushSenderService.isExpoPushToken(token)) {
            log.info("[Push] Ignoring non-Expo push token (platform={}, len={}) for user {}",
                    platform, token == null ? 0 : token.length(), user.getId());
            return;
        }
        // The token identifies the DEVICE. If other accounts logged in on this device earlier,
        // they still hold the same token — strip it from them so this device only ever receives
        // notifications for the account that is actually logged in.
        int cleared = userRepository.clearPushTokenFromOtherUsers(token, user.getId());
        if (cleared > 0) {
            log.info("[Push] Device token re-assigned to user {} (removed from {} other account(s))",
                    user.getId(), cleared);
        }
        // Native UPDATE, not save(user): push_token is updatable=false on the entity so a later
        // merge of the (up-to-60s stale) cached principal can never rewrite it. Mirror the value onto
        // the in-memory principal so anything reading it within this request stays consistent.
        userRepository.assignPushToken(user.getId(), token, platform);
        user.setPushToken(token);
        user.setPushPlatform(platform);
    }

    @Transactional
    public AuthResponse updateLocale(User user, String locale) {
        User.Locale loc = User.Locale.valueOf(locale.trim().toLowerCase());
        user.setLocale(loc);
        userRepository.save(user);
        return buildAuthResponse(user);
    }

    /**
     * Student tự cập nhật displayName, phoneNumber, locale.
     * Không cần OTP — phone validation chỉ kiểm tra uniqueness.
     */
    @Transactional
    public AuthResponse updateProfile(User user, UpdateProfileRequest req) {
        if (req.displayName() != null && !req.displayName().isBlank()) {
            user.setDisplayName(req.displayName().trim());
        }
        if (req.phoneNumber() != null && !req.phoneNumber().isBlank()) {
            String phone = req.phoneNumber().trim();
            // Kiểm tra số điện thoại chưa được dùng bởi user khác
            if (!phone.equals(user.getPhoneNumber())
                    && userRepository.existsByPhoneNumber(phone)) {
                throw new BadRequestException("Số điện thoại này đã được đăng ký, vui lòng dùng số khác.");
            }
            user.setPhoneNumber(phone);
        }
        if (req.locale() != null && !req.locale().isBlank()) {
            try {
                user.setLocale(User.Locale.valueOf(req.locale().trim().toLowerCase()));
            } catch (IllegalArgumentException ignored) {
                throw new BadRequestException("locale phải là vi, en hoặc de");
            }
        }
        userRepository.save(user);
        return buildAuthResponse(user, null, null, false);
    }

    /**
     * Student đổi mật khẩu — yêu cầu xác nhận mật khẩu hiện tại trước.
     */
    @Transactional
    public void changePassword(User user, ChangePasswordRequest req) {
        if (!passwordEncoder.matches(req.currentPassword(), user.getPasswordHash())) {
            throw new BadRequestException("Mật khẩu hiện tại không đúng.");
        }
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        userRepository.save(user);
        // Revoke tất cả refresh tokens để buộc đăng nhập lại
        refreshTokenRepository.revokeAllByUserId(user.getId());
        // …and drop the device push token so no already-logged-out session keeps getting this
        // account's notifications; the device re-registers on the forced re-login.
        userRepository.clearPushToken(user.getId());
    }

    @Transactional(readOnly = true)
    public AuthResponse me(User user) {
        String learningTargetLevel = null;
        String industry = null;
        if (user.getRole() == User.Role.STUDENT) {
            List<java.util.Map<String, Object>> rows = jdbcTemplate.queryForList(
                    """
                            SELECT target_level, industry FROM user_learning_profiles
                            WHERE user_id = ?
                            LIMIT 1
                            """,
                    user.getId());
            if (!rows.isEmpty()) {
                var row = rows.get(0);
                learningTargetLevel = (String) row.get("target_level");
                industry = (String) row.get("industry");
            }
        }
        return buildAuthResponse(user, learningTargetLevel, industry, false);
    }

    // --- private ---

    /** @param attachTokens tokens on login/register/refresh — {@code false} for {@link #me} */
    private AuthResponse buildAuthResponse(User user, String learningTargetLevel, String industry, boolean attachTokens) {
        // Org context: orgId từ principal (fast-path), orgRole từ membership ACTIVE.
        // Non-org user → cả hai null ⇒ token & response y như B2C cũ.
        Long orgId = user.getOrgId();
        String orgRole = null;
        if (orgId != null) {
            orgRole = orgMemberRepository.findByIdOrgIdAndIdUserId(orgId, user.getId())
                    .filter(m -> "ACTIVE".equals(m.getStatus()))
                    .map(OrgMember::getRole)
                    .orElse(null);
        }
        if (attachTokens) {
            String accessToken = jwtService.generateAccessToken(user, orgId, orgRole);
            String refreshToken = createRefreshToken(user);
            return new AuthResponse(
                    accessToken,
                    refreshToken,
                    user.getId(),
                    user.getEmail(),
                    user.getDisplayName(),
                    user.getRole().name(),
                    user.getLocale().name(),
                    learningTargetLevel,
                    industry,
                    orgId,
                    orgRole
            );
        }
        return new AuthResponse(
                null,
                null,
                user.getId(),
                user.getEmail(),
                user.getDisplayName(),
                user.getRole().name(),
                user.getLocale().name(),
                learningTargetLevel,
                industry,
                orgId,
                orgRole
        );
    }

    private AuthResponse buildAuthResponse(User user) {
        return buildAuthResponse(user, null, null, true);
    }

    /** Issue a fresh login session (tokens + org claims) — used by org invite-accept flow. */
    public AuthResponse issueSession(User user) {
        return buildAuthResponse(user);
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
