package com.deutschflow.user.registration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/**
 * Khối {@code app.auth.registration-verification} + {@code app.auth.legacy-register}.
 *
 * <p><b>Chặn boot</b> khi bật công tắc mà thiếu SMTP hoặc pepper: email là lối vào DUY NHẤT của luồng
 * mã PIN, nên bật nó trên một máy không gửi được thư là khoá cửa đăng ký với mọi người. Ném ở
 * constructor ⇒ ApplicationContext không khởi động, deploy blue-green dừng trước khi nhận traffic.
 */
@Component
public class RegistrationVerificationConfig {

    /** Pepper tối thiểu 32 byte — cùng cỡ khoá HMAC-SHA256. */
    static final int MIN_PEPPER_BYTES = 32;

    private final boolean enabled;
    private final byte[] pepper;
    private final int codeTtlMinutes;
    private final int maxAttemptsPerCode;
    private final int resendCooldownSeconds;
    private final boolean legacyRegisterEnabled;

    public RegistrationVerificationConfig(
            @Value("${app.auth.registration-verification.enabled:false}") boolean enabled,
            @Value("${app.auth.registration-verification.code-pepper:}") String pepper,
            @Value("${app.auth.registration-verification.code-ttl-minutes:60}") int codeTtlMinutes,
            @Value("${app.auth.registration-verification.max-attempts-per-code:5}") int maxAttemptsPerCode,
            @Value("${app.auth.registration-verification.resend-cooldown-seconds:60}") int resendCooldownSeconds,
            @Value("${app.auth.legacy-register.enabled:true}") boolean legacyRegisterEnabled,
            @Value("${spring.mail.host:}") String mailHost) {
        byte[] pepperBytes = pepper == null ? new byte[0] : pepper.trim().getBytes(StandardCharsets.UTF_8);
        if (enabled) {
            if (mailHost == null || mailHost.isBlank()) {
                throw new IllegalStateException(
                        "REGISTRATION_VERIFICATION_ENABLED=true nhưng MAIL_HOST rỗng — mã PIN không có đường gửi");
            }
            if (pepperBytes.length < MIN_PEPPER_BYTES) {
                throw new IllegalStateException(
                        "REGISTRATION_VERIFICATION_ENABLED=true nhưng REGISTRATION_CODE_PEPPER thiếu hoặc ngắn hơn "
                                + MIN_PEPPER_BYTES + " byte");
            }
        }
        this.enabled = enabled;
        this.pepper = pepperBytes;
        this.codeTtlMinutes = Math.max(1, codeTtlMinutes);
        this.maxAttemptsPerCode = Math.max(1, maxAttemptsPerCode);
        this.resendCooldownSeconds = Math.max(0, resendCooldownSeconds);
        this.legacyRegisterEnabled = legacyRegisterEnabled;
    }

    public boolean enabled() { return enabled; }
    /** Pepper HMAC của mã 6 số; dùng chung với mã quên mật khẩu ({@code PasswordResetService}). Có thể rỗng khi tắt luồng mã PIN. */
    public byte[] pepper() { return pepper.clone(); }
    public int codeTtlMinutes() { return codeTtlMinutes; }
    public int maxAttemptsPerCode() { return maxAttemptsPerCode; }
    public int resendCooldownSeconds() { return resendCooldownSeconds; }
    public boolean legacyRegisterEnabled() { return legacyRegisterEnabled; }
}
