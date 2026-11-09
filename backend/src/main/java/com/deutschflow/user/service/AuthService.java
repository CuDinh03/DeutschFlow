package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.transaction.RunAfterCommitService;
import com.deutschflow.common.security.JwtService;
import com.deutschflow.organization.entity.OrgMember;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.user.dto.AuthResponse;
import com.deutschflow.user.dto.ChangePasswordRequest;
import com.deutschflow.user.dto.LoginRequest;
import com.deutschflow.user.dto.LoginResult;
import com.deutschflow.user.dto.MfaChallengeResponse;
import com.deutschflow.user.mfa.AdminMfaPolicy;
import com.deutschflow.user.mfa.MfaException;
import com.deutschflow.user.mfa.MfaKeyMaterial;
import com.deutschflow.user.mfa.MfaService;
import com.deutschflow.user.mfa.MfaState;
import com.deutschflow.user.mfa.UserMfaStore;
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
import org.springframework.http.HttpStatus;
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

    /**
     * Trần tuổi tài khoản còn được nhận trial ở đường đăng nhập (Q1, 28/08).
     * Bằng đúng độ dài trial: quá 7 ngày thì kể cả có cấp cũng đã hết hạn.
     */
    private static final int TRIAL_BACKFILL_MAX_AGE_DAYS = 7;


    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    /** Ký URL ảnh đại diện khi trả cho client — bucket private, xem javadoc {@code UserAvatarService#viewUrl}. */
    private final UserAvatarService userAvatarService;
    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final StudentTrialSubscriptionProvisioner studentTrialSubscriptionProvisioner;
    private final RunAfterCommitService runAfterCommitService;
    private final UserNotificationService userNotificationService;
    private final OrgMemberRepository orgMemberRepository;
    /** 2FA ADMIN (09/11/2026) — chỉ chạm tới khi người dùng là ADMIN, nên test cũ không cần mock. */
    private final AdminMfaPolicy adminMfaPolicy;
    private final UserMfaStore userMfaStore;
    private final MfaKeyMaterial mfaKeyMaterial;

    @Value("${app.jwt.refresh-token-expiry-ms}")
    private long refreshTokenExpiryMs;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        // Normalize to canonical lowercase + trimmed, matching admin createUser. Keeps stored emails
        // consistent so the case-insensitive login lookup always resolves, and the IgnoreCase
        // existence check blocks creating a case-variant duplicate (Foo@x.com vs foo@x.com).
        String email = SelfRegistrationInputs.normalizeEmail(request.email());
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new BadRequestException("Email này đã được đăng ký, vui lòng dùng email khác.");
        }
        // Phone is optional (App Store 5.1.1(v)). Store NULL — not "" — when omitted: the column is
        // UNIQUE, and Postgres permits many NULLs but only one empty string, so a second no-phone
        // signup would otherwise collide. Uniqueness is only checked when a real number is given.
        String phoneNumber = SelfRegistrationInputs.normalizePhone(request.phoneNumber());
        if (phoneNumber != null && userRepository.existsByPhoneNumber(phoneNumber)) {
            throw new BadRequestException("Số điện thoại này đã được đăng ký, vui lòng dùng số khác.");
        }

        // locale đã được validate bởi @Pattern trong DTO, default về vi nếu null
        User.Locale locale = (request.locale() != null)
                ? User.Locale.valueOf(request.locale())
                : User.Locale.vi;

        User user = createSelfRegisteredStudent(email, phoneNumber,
                passwordEncoder.encode(request.password()), request.displayName(), locale);
        return buildAuthResponse(user);
    }

    /**
     * Phần thân DÙNG CHUNG của mọi đường tự đăng ký: tạo {@code STUDENT} ({@code createdVia=SELF}) → cấp
     * trial tính từ BÂY GIỜ → bắn {@code StudentRegisteredEvent} sau commit. Gọi từ {@link #register} (đường
     * cũ) và từ {@code RegistrationVerificationService.verify} (mã PIN — trial tính từ lúc xác minh xong,
     * không phải lúc bấm đăng ký). Một chỗ duy nhất để hai đường không lệch nhau về trial (bài học 13/09).
     *
     * @param passwordHash đã băm BCrypt — KHÔNG băm lại ở đây
     */
    @Transactional
    public User createSelfRegisteredStudent(String email, String phoneNumber, String passwordHash,
                                            String displayName, User.Locale locale) {
        var user = User.builder()
                .email(email)
                .phoneNumber(phoneNumber)
                .passwordHash(passwordHash)
                .displayName(displayName)
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
        return user;
    }

    /**
     * Tài khoản có đủ điều kiện nhận trial khi đăng nhập không?
     *
     * <p>Hai điều kiện, cả hai đều cần: (1) người dùng TỰ đăng ký — tài khoản do admin/
     * trung tâm tạo hộ đi theo hợp đồng B2B, không phải phễu trial; (2) mới tạo trong
     * vòng {@value #TRIAL_BACKFILL_MAX_AGE_DAYS} ngày — quá hạn đó thì việc thiếu
     * subscription là dữ liệu cũ cần vá tay, không phải người mới cần trial.
     *
     * <p>Đây là lưới an toàn cho ca "đăng ký xong nhưng provision hỏng", KHÔNG phải
     * đường cấp trial chính. Đường chính nằm ở {@code register()}.
     */
    static boolean isFreshSelfSignup(User user) {
        if (user.getCreatedVia() != User.CreatedVia.SELF) {
            return false;
        }
        LocalDateTime createdAt = user.getCreatedAt();
        if (createdAt == null) {
            return false;
        }
        return createdAt.isAfter(LocalDateTime.now().minusDays(TRIAL_BACKFILL_MAX_AGE_DAYS));
    }

    /**
     * Bước mật khẩu. Người dùng thường → {@link LoginResult.Session} (y như trước). ADMIN (2FA bắt buộc, hoặc đã
     * tự bật 2FA khi kill-switch tắt) → {@link LoginResult.MfaChallenge}: KHÔNG token, KHÔNG thu hồi phiên cũ —
     * mật khẩu đúng một mình chưa đủ để đá các phiên đang chạy; việc đó làm ở {@link #completeMfaLogin}.
     */
    @Transactional
    public LoginResult login(LoginRequest request) {
        // Trim the submitted email; the actual match is case-insensitive (UserDetailsServiceConfig +
        // findByEmailIgnoreCase). Without this, a stray space or a single capital letter made login
        // fail as "wrong password" even when the password was correct (the lookup just missed the row).
        String email = request.email() == null ? "" : request.email().trim();
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, request.password()));
        } catch (BadCredentialsException e) {
            throw new BadRequestException("Email hoặc mật khẩu không đúng.");
        }

        var user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new BadRequestException("Email hoặc mật khẩu không đúng."));

        // Q1 (quyết định owner 28/08): trial 7 ngày chỉ dành cho tài khoản VỪA ĐĂNG KÝ.
        // Trước đây bất kỳ STUDENT nào chưa có dòng subscription nào cũng được cấp trial
        // PRO ngay lúc đăng nhập — nghĩa là một tài khoản tạo từ năm ngoái, hoặc tài khoản
        // do trung tâm/admin tạo hộ, đăng nhập lần đầu vào hôm nay là nhận trọn 7 ngày PRO.
        // Đó là phát quyền lợi không ai chủ ý, và nó làm hỏng luôn phép đo cohort trial.
        if (user.getRole() == User.Role.STUDENT && isFreshSelfSignup(user)) {
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

        if (requiresMfa(user)) {
            // Thiếu khoá mã hoá thì báo NGAY ở bước mật khẩu (503) thay vì để admin đi tiếp vào ngõ cụt.
            if (mfaKeyMaterial == null || !mfaKeyMaterial.isConfigured()) {
                throw MfaException.notConfigured();
            }
            boolean enrolled = userMfaStore.isEnabled(user.getId());
            String mfaToken = jwtService.generateMfaChallengeToken(user.getId());
            return new LoginResult.MfaChallenge(
                    new MfaChallengeResponse(true, mfaToken, enrolled, MfaService.emailHint(user.getEmail())));
        }

        refreshTokenRepository.revokeAllByUserId(user.getId());
        return new LoginResult.Session(buildAuthResponse(user));
    }

    /**
     * Người dùng này có phải qua 2FA để có phiên không: ADMIN và (2FA đang bắt buộc HOẶC chính họ đã bật 2FA).
     * Kill-switch {@code app.security.admin-mfa.enforced=false} chỉ mở cửa cho admin CHƯA đăng ký.
     */
    public boolean requiresMfa(User user) {
        if (user == null || user.getRole() != User.Role.ADMIN) {
            return false;
        }
        return adminMfaPolicy.enforced() || userMfaStore.isEnabled(user.getId());
    }

    /** Lần qua 2FA lúc {@code verifiedAt} đã quá {@code app.security.admin-mfa.max-session-hours}. */
    private boolean isMfaStale(Instant verifiedAt) {
        return verifiedAt.isBefore(Instant.now().minus(adminMfaPolicy.maxSessionAge()));
    }

    /**
     * Phiên sau khi qua bước 2FA (đăng ký xong hoặc nhập mã đúng): thu hồi mọi refresh token cũ — như đăng nhập
     * thường — rồi cấp cặp token mang dấu 2FA ({@code mfa_at = verifiedAt}).
     */
    @Transactional
    public AuthResponse completeMfaLogin(User user, Instant verifiedAt) {
        refreshTokenRepository.revokeAllByUserId(user.getId());
        return buildAuthResponse(user, MfaState.verifiedAt(verifiedAt));
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

        // Audit F-H2 (03/09/2026): login kiểm is_active qua User#isEnabled (DaoAuthenticationProvider),
        // nhưng refresh thì KHÔNG — nên một tài khoản bị admin khoá vẫn tự gia hạn phiên tới 7 ngày
        // (TTL refresh token) mà không phải đăng nhập lại lần nào. Kiểm ở đây để "khoá tài khoản"
        // thật sự chấm dứt phiên; revoke luôn phần còn lại cho khỏi thử tiếp bằng token khác.
        if (!stored.getUser().isActive()) {
            refreshTokenRepository.revokeAllByUserId(stored.getUser().getId());
            throw new BadRequestException("Tài khoản đã bị khóa.");
        }

        // 2FA ADMIN: phiên phải mang mốc qua 2FA, và mốc đó chưa quá max-session-hours. Mốc được CHÉP sang dòng
        // mới (không đặt lại "bây giờ") nên refresh liên tục không kéo dài được một lần qua 2FA. Refresh token do
        // bản trước phát (mfa_verified_at NULL) rơi vào đây ⇒ admin phải đăng nhập lại sau khi deploy — chủ ý.
        User user = stored.getUser();
        Instant mfaVerifiedAt = stored.getMfaVerifiedAt();
        if (requiresMfa(user)) {
            if (mfaVerifiedAt == null || isMfaStale(mfaVerifiedAt)) {
                log.info("[AuthService] Refresh ADMIN userId={} bị từ chối: phiên chưa qua 2FA hoặc quá hạn 2FA", user.getId());
                throw MfaException.required();
            }
        }

        stored.setRevoked(true);
        refreshTokenRepository.save(stored);

        return buildAuthResponse(user, MfaState.verifiedAt(mfaVerifiedAt));
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
        // Giữ dấu 2FA của phiên đang gọi: cặp token mới của admin vẫn phải mang mfa_at gốc.
        return buildAuthResponse(user, MfaState.fromCurrentRequest());
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
        if (req.notificationTimezone() != null && !req.notificationTimezone().isBlank()) {
            String zone = req.notificationTimezone().trim();
            // Danh sách zone của JVM là nguồn duy nhất — DailyNotificationJob gọi ZoneId.of() trên
            // đúng giá trị này mỗi giờ và âm thầm rơi về Asia/Ho_Chi_Minh nếu hỏng, nên một chuỗi
            // sai lưu được ở đây sẽ biến thành "thông báo sai giờ" không ai giải thích nổi.
            if (!java.time.ZoneId.getAvailableZoneIds().contains(zone)) {
                throw new BadRequestException("Múi giờ không hợp lệ.");
            }
            user.setNotificationTimezone(zone);
        }
        if (req.reminderHourLocal() != null) {
            // -1 = bỏ giờ nhắc (về mặc định 18h); 0–23 = giờ theo notificationTimezone (Đợt 6, V337).
            user.setReminderHourLocal(req.reminderHourLocal() < 0 ? null : req.reminderHourLocal());
        }
        userRepository.save(user);
        return buildAuthResponse(user, null, null, false, MfaState.NONE);
    }

    /**
     * Đăng xuất mọi phiên KHÁC và cấp cặp token mới cho chính thiết bị đang gọi.
     *
     * <p>Vì sao phải cấp token mới thay vì "thu hồi tất cả trừ cái hiện tại": server không biết
     * refresh token nào thuộc về người gọi (access token là JWT không trạng thái). Thu sạch rồi phát
     * lại cho đúng người đang cầm access token hợp lệ đạt cùng kết quả mà không cần client gửi kèm
     * refresh token của mình.
     *
     * <p>🪤 Access token của thiết bị khác vẫn sống tới khi hết hạn (tối đa 15 phút,
     * {@code jwt.access-token-expiry-ms}) vì JWT không thu hồi được — đúng giới hạn mà
     * {@link #changePassword} đã có. Giao diện phải nói rõ mốc này, đừng hứa "ngắt ngay lập tức".
     */
    @Transactional
    public AuthResponse revokeOtherSessions(User user) {
        refreshTokenRepository.revokeAllByUserId(user.getId());
        // KHÔNG đụng push_token: nó trỏ tới MỘT thiết bị (thiết bị đăng nhập gần nhất) chứ không
        // phải phiên của người gọi — xoá ở đây sẽ tắt thông báo của chính thiết bị đang dùng.
        // Dấu 2FA lấy từ access token đang gọi (mfa_at gốc) — admin không mất 2FA, cũng không được "làm mới" nó.
        return buildAuthResponse(user, MfaState.fromCurrentRequest());
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
        return buildAuthResponse(user, learningTargetLevel, industry, false, MfaState.NONE);
    }

    // --- private ---

    /**
     * @param attachTokens tokens on login/register/refresh — {@code false} for {@link #me}
     * @param mfa          trạng thái 2FA của phiên sắp cấp (chỉ dùng khi {@code attachTokens})
     */
    private AuthResponse buildAuthResponse(User user, String learningTargetLevel, String industry, boolean attachTokens,
                                           MfaState mfa) {
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
            // CHỐT DUY NHẤT (2FA ADMIN, 09/11/2026): mọi đường cấp token đi qua đây. ADMIN phải qua 2FA mà phiên
            // này không mang mốc 2FA → KHÔNG BAO GIỜ phát token, dù người gọi là ai.
            MfaState state = mfa == null ? MfaState.NONE : mfa;
            if (requiresMfa(user)) {
                if (!state.verified()) {
                    log.warn("[AuthService] Chặn cấp token cho ADMIN userId={} chưa qua 2FA", user.getId());
                    throw MfaException.required();
                }
                // Trần tuổi của MỘT lần qua 2FA áp ở chốt này cho MỌI đường cấp token (refresh, đổi ngôn ngữ,
                // đăng xuất phiên khác…), không chỉ ở refresh(): các đường đó chép mfa_at của access token đang
                // gọi, nên nếu không kiểm ở đây thì gọi lặp lại sẽ kéo dài một lần qua 2FA quá max-session-hours.
                if (isMfaStale(state.verifiedAt())) {
                    log.info("[AuthService] Chặn cấp token cho ADMIN userId={}: lần qua 2FA đã quá {} giờ",
                            user.getId(), adminMfaPolicy.maxSessionAge().toHours());
                    throw MfaException.required();
                }
            }
            String accessToken = state.verified()
                    ? jwtService.generateAccessToken(user, orgId, orgRole, state.verifiedAt())
                    : jwtService.generateAccessToken(user, orgId, orgRole);
            String refreshToken = createRefreshToken(user, state.verifiedAt());
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
                    orgRole,
                    userAvatarService.viewUrl(user.getAvatarUrl())
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
                orgRole,
                userAvatarService.viewUrl(user.getAvatarUrl())
        );
    }

    private AuthResponse buildAuthResponse(User user) {
        return buildAuthResponse(user, MfaState.NONE);
    }

    private AuthResponse buildAuthResponse(User user, MfaState mfa) {
        return buildAuthResponse(user, null, null, true, mfa);
    }

    /**
     * Issue a fresh login session (tokens + org claims) — used by org invite-accept flow and PIN registration.
     *
     * <p>Không có bước 2FA trên các đường này, nên ADMIN bị từ chối thẳng (403 {@code MFA_REQUIRED_USE_LOGIN}):
     * admin phải đăng nhập bình thường ở {@code /api/auth/login} để qua 2FA.
     */
    public AuthResponse issueSession(User user) {
        if (user != null && user.getRole() == User.Role.ADMIN) {
            throw new MfaException(HttpStatus.FORBIDDEN, MfaException.MFA_REQUIRED_USE_LOGIN,
                    "Tài khoản quản trị phải đăng nhập bình thường (có xác thực hai lớp).");
        }
        return buildAuthResponse(user);
    }

    private String createRefreshToken(User user, Instant mfaVerifiedAt) {
        String token = UUID.randomUUID().toString();
        var rt = RefreshToken.builder()
                .user(user)
                .token(token)
                .expiresAt(LocalDateTime.now().plusSeconds(refreshTokenExpiryMs / 1000))
                .mfaVerifiedAt(mfaVerifiedAt)
                .build();
        refreshTokenRepository.save(rt);
        return token;
    }
}
