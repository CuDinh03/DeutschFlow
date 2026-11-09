package com.deutschflow.user.mfa;

import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.audit.AuditOrgResolver;
import com.deutschflow.common.exception.RateLimitExceededException;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.ArrayList;
import java.util.concurrent.Executor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("MfaService — đăng ký, xác minh, mã khôi phục, đặt lại")
class MfaServiceTest {

    private static final String IP = "203.0.113.7";

    @Mock MfaChallengeTokens challengeTokens;
    @Mock UserMfaStore store;
    @Mock UserRepository userRepository;
    @Mock RefreshTokenRepository refreshTokenRepository;
    @Mock AuthRateLimiterService rateLimiter;
    @Mock AuthService authService;
    @Mock TransactionalMail mail;
    @Mock UserNotificationService notifications;
    @Mock AuditLogService auditLogService;
    @Mock AuditOrgResolver auditOrgResolver;
    @Mock PlatformTransactionManager txManager;

    private MfaKeyMaterial keys;
    private MfaService service;
    private final User admin = User.builder().id(1L).email("owner@deutschflow.app").passwordHash("h")
            .role(User.Role.ADMIN).active(true).build();
    private final MfaChallengeTokens.Challenge challenge =
            new MfaChallengeTokens.Challenge(1L, "jti-1", Instant.now().plusSeconds(300));
    private final AuthResponse session = new AuthResponse("ACCESS", "RT", 1L, "owner@deutschflow.app", "Owner",
            "ADMIN", "vi", null, null, null, null, null);
    private byte[] secret;
    /** Lượt giữ chỗ thật (bộ nhớ) — MfaService chỉ chuyền nó lại cho limiter (mock). */
    private AuthRateLimiterService.MfaAttempt attempt;

    private static AuthRateLimiterService realLimiter() {
        return new AuthRateLimiterService(5, 60, 100, 60, 10, 600, 10, 60, 5, 900, null);
    }

    @BeforeEach
    void setUp() {
        byte[] key = new byte[32];
        new SecureRandom().nextBytes(key);
        keys = new MfaKeyMaterial(Base64.getEncoder().encodeToString(key), "k1", "pepper");
        Executor direct = Runnable::run;
        when(txManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        service = new MfaService(keys, challengeTokens, store, userRepository, refreshTokenRepository, rateLimiter,
                authService, mail, direct, notifications, auditLogService, auditOrgResolver, txManager);

        secret = new byte[20];
        new SecureRandom().nextBytes(secret);
        when(challengeTokens.parse("tok")).thenReturn(challenge);
        when(challengeTokens.burn(challenge)).thenReturn(true);
        when(challengeTokens.issue(1L)).thenReturn("tok-2");
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin));
        when(authService.completeMfaLogin(eq(admin), any())).thenReturn(session);
        when(mail.isEnabled()).thenReturn(true);
        when(rateLimiter.allowMfaEmailSend(anyLong())).thenReturn(true);
        attempt = realLimiter().tryAcquireMfaAttempt(1L, IP).orElseThrow();
        when(rateLimiter.tryAcquireMfaAttempt(anyLong(), any())).thenReturn(Optional.of(attempt));
    }

    private void enrolled() {
        var row = Optional.of(new UserMfaStore.MfaRow(1L,
                keys.cipher().encrypt(1L, secret), Instant.now().minusSeconds(3600), null));
        when(store.find(1L)).thenReturn(row);
        when(store.findForUpdate(1L)).thenReturn(row);
        when(store.isEnabled(1L)).thenReturn(true);
    }

    private void pending() {
        var row = Optional.of(new UserMfaStore.MfaRow(1L, keys.cipher().encrypt(1L, secret), null, null));
        when(store.find(1L)).thenReturn(row);
        when(store.findForUpdate(1L)).thenReturn(row);
    }

    private String wrongCode() {
        return "000000".equals(currentCode()) ? "111111" : "000000";
    }

    private String currentCode() {
        return Totp.code(secret, Totp.stepAt(Instant.now()));
    }

    // ─── verify ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("mã TOTP đúng → ghi nhận bước, đốt token, cấp phiên")
    void verifyHappyPath() {
        enrolled();
        when(store.claimStep(eq(1L), anyLong())).thenReturn(true);

        var r = service.verify("tok", currentCode(), null, IP);

        assertThat(r.session()).isSameAs(session);
        assertThat(r.usedRecoveryCode()).isFalse();
        verify(challengeTokens).burn(challenge);
        verify(store).findForUpdate(1L);
        verify(rateLimiter, never()).commitMfaFailure(any());
        verify(rateLimiter).refundMfaAttempt(attempt);
    }

    @Test
    @DisplayName("phát lại mã đã dùng (claimStep = 0 dòng) → MFA_CODE_INVALID, ghi lần sai, không phiên")
    void verifyReplayRejected() {
        enrolled();
        when(store.claimStep(eq(1L), anyLong())).thenReturn(false);

        MfaException ex = assertThrows(MfaException.class, () -> service.verify("tok", currentCode(), null, IP));

        assertThat(ex.getCode()).isEqualTo(MfaException.MFA_CODE_INVALID);
        verify(rateLimiter).commitMfaFailure(attempt);
        verify(authService, never()).completeMfaLogin(any(), any());
        verify(challengeTokens, never()).burn(any());
    }

    @Test
    @DisplayName("mã sai làm chạm trần → ghi vết user.mfa.locked")
    void wrongCodeAtLimitAudits() {
        enrolled();
        when(rateLimiter.commitMfaFailure(attempt)).thenReturn(true);

        assertThrows(MfaException.class, () -> service.verify("tok", wrongCode(), null, IP));

        verify(auditLogService).log(eq("user.mfa.locked"), any(), eq("USER"), eq("1"), anyMap());
    }

    @Test
    @DisplayName("ngân sách đầy (không giữ được chỗ) → 429 kể cả mã đúng, không chạm DB")
    void blockedReturns429() {
        when(rateLimiter.tryAcquireMfaAttempt(1L, IP)).thenReturn(Optional.empty());
        when(rateLimiter.mfaRetryAfterSeconds()).thenReturn(900);

        assertThrows(RateLimitExceededException.class, () -> service.verify("tok", currentCode(), null, IP));

        verify(store, never()).find(anyLong());
        verify(store, never()).findForUpdate(anyLong());
        verify(store, never()).claimStep(anyLong(), anyLong());
    }

    @Test
    @DisplayName("token đã bị đốt bởi request khác → MFA_TOKEN_INVALID, không phiên")
    void burnRaceRejected() {
        enrolled();
        when(store.claimStep(eq(1L), anyLong())).thenReturn(true);
        when(challengeTokens.burn(challenge)).thenReturn(false);

        MfaException ex = assertThrows(MfaException.class, () -> service.verify("tok", currentCode(), null, IP));

        assertThat(ex.getCode()).isEqualTo(MfaException.MFA_TOKEN_INVALID);
        verify(authService, never()).completeMfaLogin(any(), any());
    }

    @Test
    @DisplayName("gửi cả mã TOTP lẫn mã khôi phục (hoặc không gửi gì) → MFA_CODE_INVALID")
    void exactlyOneFactor() {
        enrolled();
        assertThrows(MfaException.class, () -> service.verify("tok", "123456", "ABCDE-FGHIJ", IP));
        assertThrows(MfaException.class, () -> service.verify("tok", null, " ", IP));
    }

    @Test
    @DisplayName("chưa bật 2FA → 409 MFA_NOT_ENROLLED")
    void verifyNotEnrolled() {
        when(store.find(1L)).thenReturn(Optional.empty());
        when(store.findForUpdate(1L)).thenReturn(Optional.empty());

        MfaException ex = assertThrows(MfaException.class, () -> service.verify("tok", "123456", null, IP));

        assertThat(ex.getCode()).isEqualTo(MfaException.MFA_NOT_ENROLLED);
        assertThat(ex.getStatus()).isEqualTo(HttpStatus.CONFLICT);
    }

    // ─── mã khôi phục ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("mã khôi phục đúng → phiên, vết recovery_used, báo đã dùng + báo sắp hết khi còn < 3")
    void recoveryCodeUsed() {
        enrolled();
        String code = "ABCDE-FGHIJ";
        String hash = RecoveryCodes.hash(keys.recoveryPepper(), 1L, code);
        when(store.consumeRecoveryCode(1L, hash)).thenReturn(true);
        when(store.remainingRecoveryCodes(1L)).thenReturn(2);

        var r = service.verify("tok", null, "abcde fghij", IP);

        assertThat(r.usedRecoveryCode()).isTrue();
        assertThat(r.recoveryCodesRemaining()).isEqualTo(2);
        verify(auditLogService).log(eq("user.mfa.recovery_used"), any(), eq("USER"), eq("1"), eq(Map.of("remaining", 2)));
        verify(notifications).deliverToUser(1L, NotificationType.MFA_RECOVERY_CODE_USED, Map.of("remaining", 2));
        verify(notifications).deliverToUser(1L, NotificationType.MFA_RECOVERY_CODES_LOW, Map.of("remaining", 2));
        verify(mail, org.mockito.Mockito.times(2)).sendRich(eq("admin-mfa-notice"), eq("owner@deutschflow.app"), anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("mã khôi phục đã dùng (UPDATE 0 dòng) → MFA_CODE_INVALID, ghi lần sai")
    void recoveryCodeSingleUse() {
        enrolled();
        when(store.consumeRecoveryCode(eq(1L), anyString())).thenReturn(false);

        assertThrows(MfaException.class, () -> service.verify("tok", null, "ABCDE-FGHIJ", IP));

        verify(rateLimiter).commitMfaFailure(attempt);
        verify(authService, never()).completeMfaLogin(any(), any());
        verify(challengeTokens, never()).burn(any());
    }

    @Test
    @DisplayName("mã khôi phục đúng nhưng token đã bị request song song đổi ra phiên → MFA_TOKEN_INVALID, ROLLBACK (mã không bị phí)")
    void recoveryCodeBurnRaceRollsBack() {
        enrolled();
        when(store.consumeRecoveryCode(eq(1L), anyString())).thenReturn(true);
        when(challengeTokens.burn(challenge)).thenReturn(false);

        MfaException ex = assertThrows(MfaException.class, () -> service.verify("tok", null, "ABCDE-FGHIJ", IP));

        assertThat(ex.getCode()).isEqualTo(MfaException.MFA_TOKEN_INVALID);
        var order = inOrder(store, challengeTokens, txManager);
        order.verify(store).findForUpdate(1L);
        order.verify(store).consumeRecoveryCode(eq(1L), anyString());
        order.verify(challengeTokens).burn(challenge);
        order.verify(txManager).rollback(any());
        verify(txManager, never()).commit(any());
        verify(authService, never()).completeMfaLogin(any(), any());
        verify(rateLimiter, never()).commitMfaFailure(any());
        verify(rateLimiter).refundMfaAttempt(attempt);
    }

    // ─── đăng ký ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("gửi mã email: lưu HASH (không lưu mã thô), gửi thư mục đích ADMIN_MFA_ENROLL")
    void sendEmailCode() {
        when(store.createEmailCode(eq(1L), any())).thenReturn(55L);

        var sent = service.sendEmailCode("tok");

        assertThat(sent.emailHint()).isEqualTo("o***@deutschflow.app");
        assertThat(sent.expiresInSeconds()).isEqualTo(600);
        ArgumentCaptor<String> hash = ArgumentCaptor.forClass(String.class);
        verify(store).setEmailCodeHash(eq(55L), hash.capture());
        assertThat(hash.getValue()).hasSize(64);
        verify(mail).sendRich(eq("admin-mfa-enroll"), eq("owner@deutschflow.app"), anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("gửi mã email khi SMTP chưa cấu hình → 503 MFA_EMAIL_UNAVAILABLE")
    void sendEmailCodeWithoutMail() {
        when(mail.isEnabled()).thenReturn(false);

        MfaException ex = assertThrows(MfaException.class, () -> service.sendEmailCode("tok"));

        assertThat(ex.getCode()).isEqualTo(MfaException.MFA_EMAIL_UNAVAILABLE);
    }

    @Test
    @DisplayName("bắt đầu đăng ký: mã email sai → lần sai tăng, không tạo bí mật")
    void beginEnrollmentWrongEmailCode() {
        String hash = RegistrationCodes.hash(keys.emailCodePepper(), 55L, "123456");
        when(store.latestOpenEmailCodeForUpdate(1L)).thenReturn(Optional.of(
                new UserMfaStore.EmailCodeRow(55L, hash, 0, Instant.now().plusSeconds(300))));

        assertThrows(MfaException.class, () -> service.beginEnrollment("tok", "654321", IP));

        verify(store).recordEmailCodeFailure(55L, 1, false);
        verify(store, never()).upsertPending(anyLong(), anyString());
        verify(rateLimiter).commitMfaFailure(attempt);
    }

    @Test
    @DisplayName("bắt đầu đăng ký: mã email đúng → bí mật mã hoá, URI otpauth, token thử thách mới")
    void beginEnrollmentOk() {
        String hash = RegistrationCodes.hash(keys.emailCodePepper(), 55L, "123456");
        when(store.latestOpenEmailCodeForUpdate(1L)).thenReturn(Optional.of(
                new UserMfaStore.EmailCodeRow(55L, hash, 0, Instant.now().plusSeconds(300))));
        when(store.upsertPending(eq(1L), anyString())).thenReturn(true);

        var start = service.beginEnrollment("tok", "123456", IP);

        assertThat(start.otpauthUri()).startsWith("otpauth://totp/DeutschFlow:").contains("secret=" + start.secretBase32());
        assertThat(start.mfaToken()).isEqualTo("tok-2");
        ArgumentCaptor<String> enc = ArgumentCaptor.forClass(String.class);
        verify(store).upsertPending(eq(1L), enc.capture());
        assertThat(enc.getValue()).startsWith("v1:k1:").doesNotContain(start.secretBase32());
        assertThat(keys.cipher().decrypt(1L, enc.getValue())).isEqualTo(Base32.decode(start.secretBase32()));
        verify(store).consumeEmailCode(55L);
        verify(challengeTokens).burn(challenge);
    }

    @Test
    @DisplayName("bắt đầu đăng ký khi đã bật → 409 MFA_ALREADY_ENABLED")
    void beginEnrollmentAlreadyEnabled() {
        when(store.isEnabled(1L)).thenReturn(true);

        MfaException ex = assertThrows(MfaException.class, () -> service.beginEnrollment("tok", "123456", IP));

        assertThat(ex.getCode()).isEqualTo(MfaException.MFA_ALREADY_ENABLED);
    }

    @Test
    @DisplayName("xác nhận đăng ký: mã đúng → bật, 10 mã khôi phục (băm), phiên, thông báo đã bật")
    void confirmEnrollment() {
        pending();
        when(store.claimStep(eq(1L), anyLong())).thenReturn(true);
        when(store.enable(eq(1L), any())).thenReturn(true);

        var result = service.confirmEnrollment("tok", currentCode(), IP);

        assertThat(result.recoveryCodes()).hasSize(10);
        assertThat(result.session()).isSameAs(session);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> hashes = ArgumentCaptor.forClass(List.class);
        verify(store).replaceRecoveryCodes(eq(1L), hashes.capture());
        assertThat(hashes.getValue()).hasSize(10)
                .containsExactlyElementsOf(result.recoveryCodes().stream()
                        .map(c -> RecoveryCodes.hash(keys.recoveryPepper(), 1L, c)).toList());
        verify(auditLogService).log(eq("user.mfa.enabled"), any(), eq("USER"), eq("1"), anyMap());
        verify(notifications).deliverToUser(eq(1L), eq(NotificationType.MFA_ENABLED), anyMap());
    }

    @Test
    @DisplayName("xác nhận đăng ký: mã sai → MFA_CODE_INVALID, không bật, token còn nguyên")
    void confirmEnrollmentWrongCode() {
        pending();

        assertThrows(MfaException.class, () -> service.confirmEnrollment("tok", wrongCode(), IP));

        verify(store, never()).enable(anyLong(), any());
        verify(challengeTokens, never()).burn(any());
        verify(rateLimiter).commitMfaFailure(attempt);
    }

    @Test
    @DisplayName("xác nhận khi chưa bắt đầu → 409 MFA_ENROLLMENT_NOT_STARTED")
    void confirmWithoutStart() {
        when(store.find(1L)).thenReturn(Optional.empty());
        when(store.findForUpdate(1L)).thenReturn(Optional.empty());

        MfaException ex = assertThrows(MfaException.class, () -> service.confirmEnrollment("tok", "123456", IP));

        assertThat(ex.getCode()).isEqualTo(MfaException.MFA_ENROLLMENT_NOT_STARTED);
    }

    // ─── tạo lại mã + đặt lại ─────────────────────────────────────────────────

    @Test
    @DisplayName("tạo lại mã khôi phục cần mã TOTP đúng và chưa dùng")
    void regenerate() {
        enrolled();
        when(store.claimStep(eq(1L), anyLong())).thenReturn(true);

        List<String> codes = service.regenerateRecoveryCodes(admin, currentCode(), IP);

        assertThat(codes).hasSize(10);
        verify(store).replaceRecoveryCodes(eq(1L), any());
        verify(auditLogService).log(eq("user.mfa.recovery_regenerated"), any(), eq("USER"), eq("1"), anyMap());
    }

    @Test
    @DisplayName("admin tự đặt lại 2FA của chính mình → 403 MFA_RESET_SELF_FORBIDDEN, không xoá gì")
    void adminResetSelfForbidden() {
        MfaException ex = assertThrows(MfaException.class, () -> service.adminReset(admin, 1L, "lý do đủ dài ở đây"));

        assertThat(ex.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(ex.getCode()).isEqualTo(MfaException.MFA_RESET_SELF_FORBIDDEN);
        verify(store, never()).deleteAll(anyLong());
    }

    @Test
    @DisplayName("admin khác đặt lại: xoá 2FA, cắt phiên, ghi vết có lý do, báo người bị đặt lại")
    void adminResetOther() {
        User other = User.builder().id(5L).email("second@x.com").role(User.Role.ADMIN).active(true).passwordHash("h").build();
        when(userRepository.findById(5L)).thenReturn(Optional.of(other));
        when(store.deleteAll(5L)).thenReturn(1);
        when(refreshTokenRepository.revokeAllByUserId(5L)).thenReturn(3);

        Map<String, Object> out = service.adminReset(admin, 5L, "Mất điện thoại, đã xác minh qua gọi video");

        assertThat(out).containsEntry("hadMfa", true).containsEntry("revokedSessions", 3);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> meta = ArgumentCaptor.forClass(Map.class);
        verify(auditLogService).log(eq("admin.user.mfa.reset"), any(), eq("USER"), eq("5"), any(), meta.capture());
        assertThat(meta.getValue()).containsEntry("reason", "Mất điện thoại, đã xác minh qua gọi video");
        verify(notifications).deliverToUser(eq(5L), eq(NotificationType.MFA_RESET_BY_ADMIN), anyMap());
    }

    @Test
    @DisplayName("thiếu khoá → mọi bước 2FA trả 503 MFA_NOT_CONFIGURED")
    void notConfigured() {
        MfaService unconfigured = new MfaService(new MfaKeyMaterial("", "k1", ""), challengeTokens, store,
                userRepository, refreshTokenRepository, rateLimiter, authService, mail, Runnable::run, notifications,
                auditLogService, auditOrgResolver, txManager);

        MfaException ex = assertThrows(MfaException.class, () -> unconfigured.verify("tok", "123456", null, IP));

        assertThat(ex.getCode()).isEqualTo(MfaException.MFA_NOT_CONFIGURED);
        assertThat(ex.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }

    // ─── chạy song song (ngân sách thật, bộ nhớ) ─────────────────────────────

    private MfaService serviceWith(AuthRateLimiterService limiter) {
        return new MfaService(keys, challengeTokens, store, userRepository, refreshTokenRepository, limiter,
                authService, mail, Runnable::run, notifications, auditLogService, auditOrgResolver, txManager);
    }

    @Test
    @DisplayName("20 lượt đoán SAI song song → đúng 5 lượt được kiểm mã, 15 lượt 429; sau đó mã ĐÚNG cũng 429")
    void concurrentWrongGuessesNeverExceedBudget() throws Exception {
        enrolled();
        AtomicInteger checked = new AtomicInteger();
        // Kiểm mã chậm (giữ khoá dòng ~30 ms) để mọi luồng chồng lên nhau — với kiểm-chỉ-đọc cũ cả 20 cùng lọt.
        when(store.findForUpdate(1L)).thenAnswer(inv -> {
            checked.incrementAndGet();
            Thread.sleep(30);
            return Optional.of(new UserMfaStore.MfaRow(1L, keys.cipher().encrypt(1L, secret),
                    Instant.now().minusSeconds(3600), null));
        });
        when(store.claimStep(eq(1L), anyLong())).thenReturn(true);
        AuthRateLimiterService limiter = realLimiter();
        MfaService svc = serviceWith(limiter);
        String wrong = wrongCode();

        int threads = 20;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch go = new CountDownLatch(1);
        List<Future<String>> results = new ArrayList<>();
        try {
            for (int i = 0; i < threads; i++) {
                results.add(pool.submit(() -> {
                    go.await();
                    try {
                        svc.verify("tok", wrong, null, IP);
                        return "ok";
                    } catch (RateLimitExceededException e) {
                        return "429";
                    } catch (MfaException e) {
                        return e.getCode();
                    }
                }));
            }
            go.countDown();
            List<String> outcomes = new ArrayList<>();
            for (Future<String> f : results) {
                outcomes.add(f.get(10, TimeUnit.SECONDS));
            }
            assertThat(outcomes).filteredOn("429"::equals).hasSize(15);
            assertThat(outcomes).filteredOn(MfaException.MFA_CODE_INVALID::equals).hasSize(5);
        } finally {
            pool.shutdownNow();
        }
        assertThat(checked.get()).isEqualTo(5);
        assertThat(limiter.isMfaBlocked(1L, IP)).isTrue();

        assertThrows(RateLimitExceededException.class, () -> svc.verify("tok", currentCode(), null, IP));
        verify(store, never()).claimStep(anyLong(), anyLong());
        verify(authService, never()).completeMfaLogin(any(), any());
    }

    @Test
    @DisplayName("lượt ĐÚNG được trả chỗ: 10 lần xác minh đúng liên tiếp không làm đầy ngân sách 5")
    void successfulAttemptsAreRefunded() {
        enrolled();
        when(store.claimStep(eq(1L), anyLong())).thenReturn(true);
        AuthRateLimiterService limiter = realLimiter();
        MfaService svc = serviceWith(limiter);

        for (int i = 0; i < 10; i++) {
            assertThat(svc.verify("tok", currentCode(), null, IP).session()).isSameAs(session);
        }
        assertThat(limiter.isMfaBlocked(1L, IP)).isFalse();
    }

    @Test
    @DisplayName("request hỏng không phải do đoán mã (token đã đốt) → trả chỗ, không tính lần sai")
    void nonGuessFailuresAreRefunded() {
        enrolled();
        when(store.claimStep(eq(1L), anyLong())).thenReturn(true);
        when(challengeTokens.burn(challenge)).thenReturn(false);
        AuthRateLimiterService limiter = realLimiter();
        MfaService svc = serviceWith(limiter);

        for (int i = 0; i < 10; i++) {
            assertThrows(MfaException.class, () -> svc.verify("tok", currentCode(), null, IP));
        }
        assertThat(limiter.isMfaBlocked(1L, IP)).isFalse();
    }
}
