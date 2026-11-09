package com.deutschflow.user.mfa;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.audit.AuditOrgResolver;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.exception.RateLimitExceededException;
import com.deutschflow.common.mail.CodeMail;
import com.deutschflow.common.mail.TransactionalMail;
import com.deutschflow.notification.NotificationType;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.user.dto.AuthResponse;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.registration.RegistrationCodes;
import com.deutschflow.user.repository.RefreshTokenRepository;
import com.deutschflow.user.repository.UserRepository;
import com.deutschflow.user.service.AuthRateLimiterService;
import com.deutschflow.user.service.AuthService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.OptionalLong;
import java.util.concurrent.Executor;

/**
 * Xác thực hai lớp (TOTP) cho tài khoản ADMIN — owner chốt 09/11/2026: bắt buộc với mọi ADMIN, có mã khôi
 * phục dùng một lần; lần bật đầu tiên cần mật khẩu + mã 6 số gửi qua email, rồi xác nhận mã TOTP.
 *
 * <p>Luồng (mọi bước "trước khi có phiên" xác thực bằng token thử thách {@code typ=mfa} trong body):
 * <ol>
 *   <li>{@code POST /api/auth/login} → ADMIN nhận {@code {mfaRequired, mfaToken, enrolled, emailHint}}, KHÔNG token;</li>
 *   <li>chưa đăng ký: {@link #sendEmailCode} → {@link #beginEnrollment} (đổi mã email lấy URI {@code otpauth://}
 *       + token thử thách MỚI) → {@link #confirmEnrollment} (mã TOTP đầu tiên → bật, 10 mã khôi phục, phiên);</li>
 *   <li>đã đăng ký: {@link #verify} bằng mã TOTP hoặc một mã khôi phục → phiên.</li>
 * </ol>
 *
 * <p>Chống dò: mỗi lần sai ghi vào ngân sách 5 lần / 15 phút theo người dùng VÀ theo IP
 * ({@link AuthRateLimiterService#recordMfaFailure}); đang bị khoá thì kể cả mã đúng cũng 429. Chống phát lại:
 * một mã TOTP chỉ dùng được một lần ({@link UserMfaStore#claimStep}), một mã khôi phục chỉ đốt được một lần,
 * và token thử thách bị đốt khi đổi ra phiên ({@link MfaChallengeTokens#burn}).
 */
@Slf4j
@Service
public class MfaService {

    static final String ISSUER = "DeutschFlow";
    static final int EMAIL_CODE_TTL_MINUTES = 10;
    static final int EMAIL_CODE_MAX_ATTEMPTS = 5;
    /** Dưới ngưỡng này thì báo "sắp hết mã khôi phục". */
    static final int RECOVERY_LOW_THRESHOLD = 3;

    private static final SecureRandom RNG = new SecureRandom();

    private final MfaKeyMaterial keys;
    private final MfaChallengeTokens challengeTokens;
    private final UserMfaStore store;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final AuthRateLimiterService rateLimiter;
    private final AuthService authService;
    private final TransactionalMail mail;
    private final Executor mailExecutor;
    private final UserNotificationService notifications;
    private final AuditLogService auditLogService;
    private final AuditOrgResolver auditOrgResolver;
    private final TransactionTemplate tx;

    /** Phiên hỗ trợ chỉ-đọc (V370): đóng phiên của admin bị đặt lại 2FA. Null trong test dựng tay. */
    private org.springframework.context.ApplicationEventPublisher supportSessionEvents;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setSupportSessionEvents(org.springframework.context.ApplicationEventPublisher supportSessionEvents) {
        this.supportSessionEvents = supportSessionEvents;
    }

    public MfaService(MfaKeyMaterial keys,
                      MfaChallengeTokens challengeTokens,
                      UserMfaStore store,
                      UserRepository userRepository,
                      RefreshTokenRepository refreshTokenRepository,
                      AuthRateLimiterService rateLimiter,
                      AuthService authService,
                      TransactionalMail mail,
                      @Qualifier("taskExecutor") Executor mailExecutor,
                      UserNotificationService notifications,
                      AuditLogService auditLogService,
                      AuditOrgResolver auditOrgResolver,
                      PlatformTransactionManager transactionManager) {
        this.keys = keys;
        this.challengeTokens = challengeTokens;
        this.store = store;
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.rateLimiter = rateLimiter;
        this.authService = authService;
        this.mail = mail;
        this.mailExecutor = mailExecutor;
        this.notifications = notifications;
        this.auditLogService = auditLogService;
        this.auditOrgResolver = auditOrgResolver;
        this.tx = new TransactionTemplate(transactionManager);
    }

    public record EmailCodeSent(String emailHint, int expiresInSeconds) {}

    public record EnrollmentStart(String otpauthUri, String secretBase32, String mfaToken) {}

    public record EnrollmentResult(List<String> recoveryCodes, AuthResponse session) {}

    public record VerifyResult(AuthResponse session, boolean usedRecoveryCode, Integer recoveryCodesRemaining) {}

    public record MfaStatus(boolean enabled, Instant enabledAt, int recoveryCodesRemaining) {}

    // ─── Trước khi có phiên (token thử thách) ───────────────────────────────

    /** Gửi mã 6 số qua email cho lần đăng ký 2FA đầu tiên. */
    public EmailCodeSent sendEmailCode(String mfaToken) {
        keys.requireConfigured();
        MfaChallengeTokens.Challenge c = challengeTokens.parse(mfaToken);
        User user = loadUser(c.userId());
        if (store.isEnabled(user.getId())) {
            throw alreadyEnabled();
        }
        if (!mail.isEnabled()) {
            throw emailUnavailable();
        }
        if (!rateLimiter.allowMfaEmailSend(user.getId())) {
            throw new RateLimitExceededException("Đã gửi quá nhiều mã. Vui lòng thử lại sau.",
                    rateLimiter.mfaEmailSendRetryAfterSeconds());
        }
        String code = RegistrationCodes.generate();
        byte[] pepper = keys.emailCodePepper();
        Instant expiresAt = Instant.now().plus(EMAIL_CODE_TTL_MINUTES, ChronoUnit.MINUTES);
        tx.executeWithoutResult(s -> {
            long id = store.createEmailCode(user.getId(), expiresAt);
            store.setEmailCodeHash(id, RegistrationCodes.hash(pepper, id, code));
        });
        try {
            var m = CodeMail.code(CodeMail.Purpose.ADMIN_MFA_ENROLL, localeOf(user), code, EMAIL_CODE_TTL_MINUTES);
            mail.sendRich("admin-mfa-enroll", user.getEmail(), m.subject(), m.text(), m.html());
        } catch (Exception e) {
            log.warn("[MFA] Không gửi được mã email 2FA cho userId={}: {}", user.getId(), e.getMessage());
            throw emailUnavailable();
        }
        return new EmailCodeSent(emailHint(user.getEmail()), EMAIL_CODE_TTL_MINUTES * 60);
    }

    /**
     * Đổi mã email lấy bí mật TOTP mới (đang chờ xác nhận). Trả URI {@code otpauth://} để dựng QR, bí mật
     * Base32 để nhập tay, và một token thử thách MỚI (5 phút nữa để quét mã và xác nhận) — token cũ bị đốt.
     */
    public EnrollmentStart beginEnrollment(String mfaToken, String emailCode, String ip) {
        keys.requireConfigured();
        MfaChallengeTokens.Challenge c = challengeTokens.parse(mfaToken);
        guardNotBlocked(c.userId(), ip);
        User user = loadUser(c.userId());
        if (store.isEnabled(user.getId())) {
            throw alreadyEnabled();
        }
        byte[] pepper = keys.emailCodePepper();
        Boolean ok = tx.execute(s -> checkEmailCode(user.getId(), emailCode, pepper));
        if (!Boolean.TRUE.equals(ok)) {
            throw fail(user, ip);
        }
        byte[] secret = new byte[Totp.SECRET_BYTES];
        RNG.nextBytes(secret);
        String enc = keys.cipher().encrypt(user.getId(), secret);
        if (!store.upsertPending(user.getId(), enc)) {
            throw alreadyEnabled();
        }
        if (!challengeTokens.burn(c)) {
            throw MfaException.tokenInvalid();
        }
        String secretB32 = Base32.encode(secret);
        return new EnrollmentStart(otpauthUri(user.getEmail(), secretB32), secretB32, challengeTokens.issue(user.getId()));
    }

    /** Mã TOTP đầu tiên đúng → bật 2FA, phát 10 mã khôi phục (hiện MỘT lần) và cấp phiên đã qua 2FA. */
    public EnrollmentResult confirmEnrollment(String mfaToken, String totpCode, String ip) {
        keys.requireConfigured();
        MfaChallengeTokens.Challenge c = challengeTokens.parse(mfaToken);
        guardNotBlocked(c.userId(), ip);
        User user = loadUser(c.userId());
        UserMfaStore.MfaRow row = store.find(user.getId()).orElseThrow(() -> new MfaException(HttpStatus.CONFLICT,
                MfaException.MFA_ENROLLMENT_NOT_STARTED, "Chưa bắt đầu thiết lập xác thực hai lớp."));
        if (row.enabled()) {
            throw alreadyEnabled();
        }
        byte[] secret = keys.cipher().decrypt(user.getId(), row.secretEnc());
        OptionalLong step = Totp.verify(secret, totpCode, Totp.stepAt(Instant.now()), Totp.DEFAULT_WINDOW);
        if (step.isEmpty()) {
            throw fail(user, ip);
        }
        if (!challengeTokens.burn(c)) {
            throw MfaException.tokenInvalid();
        }
        Instant now = Instant.now();
        List<String> codes = RecoveryCodes.generate();
        byte[] pepper = keys.recoveryPepper();
        String outcome = tx.execute(s -> {
            if (!store.claimStep(user.getId(), step.getAsLong())) {
                s.setRollbackOnly();
                return "replay";
            }
            if (!store.enable(user.getId(), now)) {
                s.setRollbackOnly();
                return "already";
            }
            store.replaceRecoveryCodes(user.getId(), hashAll(pepper, user.getId(), codes));
            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("recoveryCodesIssued", codes.size());
            auditLogService.log("user.mfa.enabled", AuditActor.of(user), "USER", String.valueOf(user.getId()), meta);
            return "ok";
        });
        if ("replay".equals(outcome)) {
            throw fail(user, ip);
        }
        if ("already".equals(outcome)) {
            throw alreadyEnabled();
        }
        AuthResponse session = authService.completeMfaLogin(user, now);
        notifySafely(user, NotificationType.MFA_ENABLED, Map.of("enabledAt", now.toString()),
                CodeMail.SecurityNotice.MFA_ENABLED, 0);
        log.info("[MFA] 2FA đã bật cho userId={}", user.getId());
        return new EnrollmentResult(codes, session);
    }

    /** Đăng nhập bước 2: đúng MỘT trong hai — mã TOTP 6 số hoặc một mã khôi phục. */
    public VerifyResult verify(String mfaToken, String totpCode, String recoveryCode, String ip) {
        keys.requireConfigured();
        MfaChallengeTokens.Challenge c = challengeTokens.parse(mfaToken);
        guardNotBlocked(c.userId(), ip);
        User user = loadUser(c.userId());
        UserMfaStore.MfaRow row = store.find(user.getId()).filter(UserMfaStore.MfaRow::enabled)
                .orElseThrow(MfaService::notEnrolled);
        boolean hasTotp = totpCode != null && !totpCode.isBlank();
        boolean hasRecovery = recoveryCode != null && !recoveryCode.isBlank();
        if (hasTotp == hasRecovery) {
            throw MfaException.codeInvalid();
        }
        Integer remaining = null;
        if (hasRecovery) {
            String hash = RecoveryCodes.hash(keys.recoveryPepper(), user.getId(), recoveryCode);
            Boolean consumed = hash != null && Boolean.TRUE.equals(tx.execute(s -> store.consumeRecoveryCode(user.getId(), hash)));
            if (!Boolean.TRUE.equals(consumed)) {
                throw fail(user, ip);
            }
            remaining = store.remainingRecoveryCodes(user.getId());
        } else {
            byte[] secret = keys.cipher().decrypt(user.getId(), row.secretEnc());
            OptionalLong step = Totp.verify(secret, totpCode, Totp.stepAt(Instant.now()), Totp.DEFAULT_WINDOW);
            if (step.isEmpty() || !store.claimStep(user.getId(), step.getAsLong())) {
                throw fail(user, ip);
            }
        }
        if (!challengeTokens.burn(c)) {
            throw MfaException.tokenInvalid();
        }
        AuthResponse session = authService.completeMfaLogin(user, Instant.now());
        if (remaining != null) {
            int left = remaining;
            auditLogService.log("user.mfa.recovery_used", AuditActor.of(user), "USER", String.valueOf(user.getId()),
                    Map.of("remaining", left));
            notifySafely(user, NotificationType.MFA_RECOVERY_CODE_USED, Map.of("remaining", left),
                    CodeMail.SecurityNotice.RECOVERY_CODE_USED, left);
            if (left < RECOVERY_LOW_THRESHOLD) {
                notifySafely(user, NotificationType.MFA_RECOVERY_CODES_LOW, Map.of("remaining", left),
                        CodeMail.SecurityNotice.RECOVERY_CODES_LOW, left);
            }
        }
        return new VerifyResult(session, remaining != null, remaining);
    }

    // ─── Đã có phiên ─────────────────────────────────────────────────────────

    public MfaStatus status(User user) {
        return store.find(user.getId())
                .filter(UserMfaStore.MfaRow::enabled)
                .map(r -> new MfaStatus(true, r.enabledAt(), store.remainingRecoveryCodes(user.getId())))
                .orElseGet(() -> new MfaStatus(false, null, 0));
    }

    /** Phát bộ mã khôi phục mới (bộ cũ hết hiệu lực) — cần mã TOTP hiện tại. */
    public List<String> regenerateRecoveryCodes(User user, String totpCode, String ip) {
        keys.requireConfigured();
        guardNotBlocked(user.getId(), ip);
        UserMfaStore.MfaRow row = store.find(user.getId()).filter(UserMfaStore.MfaRow::enabled)
                .orElseThrow(MfaService::notEnrolled);
        byte[] secret = keys.cipher().decrypt(user.getId(), row.secretEnc());
        OptionalLong step = Totp.verify(secret, totpCode, Totp.stepAt(Instant.now()), Totp.DEFAULT_WINDOW);
        if (step.isEmpty() || !store.claimStep(user.getId(), step.getAsLong())) {
            throw fail(user, ip);
        }
        List<String> codes = RecoveryCodes.generate();
        byte[] pepper = keys.recoveryPepper();
        tx.executeWithoutResult(s -> {
            store.replaceRecoveryCodes(user.getId(), hashAll(pepper, user.getId(), codes));
            auditLogService.log("user.mfa.recovery_regenerated", AuditActor.of(user), "USER",
                    String.valueOf(user.getId()), Map.of("recoveryCodesIssued", codes.size()));
        });
        return codes;
    }

    /**
     * Một ADMIN đặt lại 2FA của người khác (mất điện thoại + hết mã khôi phục): xoá bí mật + mã khôi phục, cắt
     * mọi phiên, ghi vết, báo cho người bị đặt lại. Không bao giờ cho tự đặt lại của chính mình — kẻ đánh cắp
     * một phiên admin không được tự gỡ 2FA để giữ tài khoản.
     *
     * <p>Không cần khoá mã hoá (chỉ xoá dữ liệu) — dùng được cả khi 2FA đang {@code MFA_NOT_CONFIGURED}.
     * 🪤 Access token đã phát của người bị đặt lại vẫn sống tới hết TTL (≤ 15 phút) — JWT không thu hồi được.
     */
    public Map<String, Object> adminReset(User actor, long targetUserId, String reason) {
        if (actor == null) {
            throw new MfaException(HttpStatus.FORBIDDEN, MfaException.MFA_RESET_SELF_FORBIDDEN, "Thiếu người thao tác.");
        }
        if (actor.getId() != null && actor.getId() == targetUserId) {
            throw new MfaException(HttpStatus.FORBIDDEN, MfaException.MFA_RESET_SELF_FORBIDDEN,
                    "Không thể tự đặt lại xác thực hai lớp của chính mình. Nhờ một quản trị viên khác.");
        }
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng."));
        Long touchedOrgId = auditOrgResolver.forUser(targetUserId);
        Map<String, Object> result = tx.execute(s -> {
            boolean hadMfa = store.deleteAll(targetUserId) > 0;
            int revoked = refreshTokenRepository.revokeAllByUserId(targetUserId);
            // Phiên hỗ trợ chỉ-đọc: admin bị đặt lại 2FA ⇒ phiên "xem như người dùng" của admin đó đóng theo.
            if (supportSessionEvents != null) {
                supportSessionEvents.publishEvent(
                        com.deutschflow.common.security.support.SupportSessionRevocationEvent.forAdmin(targetUserId,
                                com.deutschflow.admin.support.SupportSessionService.END_ADMIN_MFA_RESET));
            }
            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("hadMfa", hadMfa);
            meta.put("revokedSessions", revoked);
            meta.put("reason", reason);
            auditLogService.log("admin.user.mfa.reset", AuditActor.of(actor), "USER",
                    String.valueOf(targetUserId), touchedOrgId, meta);
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("userId", targetUserId);
            out.put("hadMfa", hadMfa);
            out.put("revokedSessions", revoked);
            return out;
        });
        notifySafely(target, NotificationType.MFA_RESET_BY_ADMIN,
                Map.of("actorEmail", actor.getEmail() == null ? "" : actor.getEmail()),
                CodeMail.SecurityNotice.MFA_RESET_BY_ADMIN, 0);
        log.info("[MFA] userId={} đặt lại 2FA của userId={}", actor.getId(), targetUserId);
        return result;
    }

    // ─── Nội bộ ──────────────────────────────────────────────────────────────

    /** Trong transaction: kiểm mã email mới nhất còn mở; sai thì cộng lần sai (COMMIT) và trả false. */
    private boolean checkEmailCode(long userId, String code, byte[] pepper) {
        var open = store.latestOpenEmailCodeForUpdate(userId);
        if (open.isEmpty()) {
            return false;
        }
        var row = open.get();
        if (row.expiresAt() == null || Instant.now().isAfter(row.expiresAt())) {
            store.consumeEmailCode(row.id());
            return false;
        }
        String typed = code == null ? null : code.replaceAll("\\s", "");
        if (row.codeHash() == null || !RegistrationCodes.matches(pepper, row.id(), typed, row.codeHash())) {
            int attempts = row.attempts() + 1;
            store.recordEmailCodeFailure(row.id(), attempts, attempts >= EMAIL_CODE_MAX_ATTEMPTS);
            return false;
        }
        store.consumeEmailCode(row.id());
        return true;
    }

    private void guardNotBlocked(long userId, String ip) {
        if (rateLimiter.isMfaBlocked(userId, ip)) {
            throw new RateLimitExceededException("Quá nhiều lần nhập sai mã. Vui lòng thử lại sau.",
                    rateLimiter.mfaRetryAfterSeconds());
        }
    }

    /** Ghi một lần sai; lần sai làm chạm trần thì để lại vết {@code user.mfa.locked}. Trả lỗi để ném. */
    private MfaException fail(User user, String ip) {
        boolean nowLocked = rateLimiter.recordMfaFailure(user.getId(), ip);
        if (nowLocked) {
            try {
                Map<String, Object> meta = new LinkedHashMap<>();
                meta.put("ip", ip == null ? "" : ip);
                auditLogService.log("user.mfa.locked", AuditActor.of(user), "USER", String.valueOf(user.getId()), meta);
            } catch (Exception e) {
                log.warn("[MFA] Không ghi được vết user.mfa.locked: {}", e.getMessage());
            }
            log.warn("[MFA] userId={} chạm trần nhập sai 2FA", user.getId());
        }
        return MfaException.codeInvalid();
    }

    private User loadUser(long userId) {
        User user = userRepository.findById(userId).orElseThrow(MfaException::tokenInvalid);
        if (!user.isActive()) {
            throw MfaException.tokenInvalid();
        }
        return user;
    }

    private void notifySafely(User user, NotificationType type, Map<String, Object> payload,
                              CodeMail.SecurityNotice notice, int remaining) {
        try {
            notifications.deliverToUser(user.getId(), type, payload);
        } catch (Exception e) {
            log.warn("[MFA] Không tạo được thông báo {} cho userId={}: {}", type, user.getId(), e.getMessage());
        }
        if (!mail.isEnabled()) {
            return;
        }
        String to = user.getEmail();
        String locale = localeOf(user);
        try {
            mailExecutor.execute(() -> {
                try {
                    var m = CodeMail.securityNotice(notice, locale, remaining);
                    mail.sendRich("admin-mfa-notice", to, m.subject(), m.text(), m.html());
                } catch (Exception e) {
                    log.warn("[MFA] Không gửi được thư {}: {}", notice, e.getMessage());
                }
            });
        } catch (Exception e) {
            log.warn("[MFA] Không xếp được thư {}: {}", notice, e.getMessage());
        }
    }

    private static List<String> hashAll(byte[] pepper, long userId, List<String> codes) {
        List<String> hashes = new ArrayList<>(codes.size());
        for (String code : codes) {
            hashes.add(RecoveryCodes.hash(pepper, userId, code));
        }
        return hashes;
    }

    static String otpauthUri(String email, String secretB32) {
        String label = enc(ISSUER) + ":" + enc(email);
        return "otpauth://totp/" + label + "?secret=" + secretB32 + "&issuer=" + enc(ISSUER)
                + "&algorithm=SHA1&digits=" + Totp.DIGITS + "&period=" + Totp.STEP_SECONDS;
    }

    private static String enc(String s) {
        return URLEncoder.encode(s == null ? "" : s, StandardCharsets.UTF_8).replace("+", "%20");
    }

    /** "a***@x.com" — đủ để người dùng nhận ra hộp thư, không lộ địa chỉ cho người đứng cạnh màn hình. */
    public static String emailHint(String email) {
        if (email == null || !email.contains("@")) {
            return "***";
        }
        int at = email.indexOf('@');
        String local = email.substring(0, at);
        String domain = email.substring(at + 1);
        return (local.isEmpty() ? "" : local.substring(0, 1)) + "***@" + domain;
    }

    private static String localeOf(User user) {
        return user.getLocale() == null ? "vi" : user.getLocale().name();
    }

    private static MfaException alreadyEnabled() {
        return new MfaException(HttpStatus.CONFLICT, MfaException.MFA_ALREADY_ENABLED,
                "Tài khoản đã bật xác thực hai lớp.");
    }

    private static MfaException notEnrolled() {
        return new MfaException(HttpStatus.CONFLICT, MfaException.MFA_NOT_ENROLLED,
                "Tài khoản chưa bật xác thực hai lớp.");
    }

    private static MfaException emailUnavailable() {
        return new MfaException(HttpStatus.SERVICE_UNAVAILABLE, MfaException.MFA_EMAIL_UNAVAILABLE,
                "Máy chủ chưa gửi được thư mã. Vui lòng thử lại sau hoặc liên hệ người vận hành.");
    }
}
