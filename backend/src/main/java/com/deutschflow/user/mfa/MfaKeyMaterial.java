package com.deutschflow.user.mfa;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.Base64;

/**
 * Khoá của 2FA, đọc một lần lúc khởi động:
 * <ul>
 *   <li>{@code app.security.mfa.encryption-key} ({@code MFA_ENCRYPTION_KEY}) — base64 của đúng 32 byte,
 *       khoá AES-256-GCM mã hoá bí mật TOTP;</li>
 *   <li>{@code app.security.mfa.key-id} (mặc định {@code k1}) — ghi vào từng bí mật đã mã hoá;</li>
 *   <li>{@code app.security.mfa.recovery-pepper} ({@code MFA_RECOVERY_PEPPER}) — pepper HMAC của mã khôi
 *       phục. Thiếu thì DẪN XUẤT từ khoá mã hoá với nhãn riêng (HMAC(key, nhãn)) — hai giá trị vẫn khác nhau,
 *       nhưng lộ khoá là lộ cả pepper, nên production đặt riêng.</li>
 * </ul>
 *
 * <p><b>Thiếu/sai khoá KHÔNG làm backend dừng khởi động</b> (người dùng khác vẫn phải đăng nhập được): log
 * ERROR và mọi thao tác 2FA trả 503 {@code MFA_NOT_CONFIGURED} — đóng chặt, không bao giờ "bỏ qua 2FA".
 * Pepper mã email 2FA luôn dẫn xuất từ khoá mã hoá (nhãn riêng), không cần biến thứ ba.
 */
@Slf4j
@Component
public class MfaKeyMaterial {

    static final String RECOVERY_PEPPER_LABEL = "deutschflow/mfa/recovery-pepper/v1";
    static final String EMAIL_CODE_PEPPER_LABEL = "deutschflow/mfa/email-code-pepper/v1";

    private final MfaSecretCipher cipher;
    private final byte[] recoveryPepper;
    private final byte[] emailCodePepper;

    public MfaKeyMaterial(@Value("${app.security.mfa.encryption-key:}") String encryptionKeyB64,
                          @Value("${app.security.mfa.key-id:k1}") String keyId,
                          @Value("${app.security.mfa.recovery-pepper:}") String recoveryPepper) {
        byte[] key = parseKey(encryptionKeyB64);
        if (key == null) {
            this.cipher = null;
            this.recoveryPepper = null;
            this.emailCodePepper = null;
            log.error("[MFA] MFA_ENCRYPTION_KEY thiếu hoặc không phải base64 của 32 byte — 2FA KHÔNG hoạt động: "
                    + "admin không đăng nhập được (503 MFA_NOT_CONFIGURED). Xem docs/RUNBOOK_2FA_ADMIN.md.");
            return;
        }
        MfaSecretCipher built;
        try {
            built = new MfaSecretCipher(keyId == null || keyId.isBlank() ? "k1" : keyId.trim(), key);
        } catch (IllegalArgumentException e) {
            log.error("[MFA] app.security.mfa.key-id không hợp lệ ({}) — 2FA KHÔNG hoạt động.", e.getMessage());
            this.cipher = null;
            this.recoveryPepper = null;
            this.emailCodePepper = null;
            return;
        }
        this.cipher = built;
        if (recoveryPepper != null && !recoveryPepper.isBlank()) {
            this.recoveryPepper = recoveryPepper.trim().getBytes(StandardCharsets.UTF_8);
        } else {
            log.warn("[MFA] MFA_RECOVERY_PEPPER chưa đặt — pepper mã khôi phục dẫn xuất từ MFA_ENCRYPTION_KEY. "
                    + "Production nên đặt riêng (docs/RUNBOOK_2FA_ADMIN.md).");
            this.recoveryPepper = derive(key, RECOVERY_PEPPER_LABEL);
        }
        this.emailCodePepper = derive(key, EMAIL_CODE_PEPPER_LABEL);
        log.info("[MFA] Khoá 2FA đã nạp (keyId={}).", built.keyId());
    }

    public boolean isConfigured() {
        return cipher != null;
    }

    /** @throws MfaException 503 {@code MFA_NOT_CONFIGURED} khi thiếu khoá */
    public void requireConfigured() {
        if (!isConfigured()) {
            throw MfaException.notConfigured();
        }
    }

    public MfaSecretCipher cipher() {
        requireConfigured();
        return cipher;
    }

    public byte[] recoveryPepper() {
        requireConfigured();
        return recoveryPepper.clone();
    }

    public byte[] emailCodePepper() {
        requireConfigured();
        return emailCodePepper.clone();
    }

    static byte[] parseKey(String b64) {
        if (b64 == null || b64.isBlank()) {
            return null;
        }
        try {
            byte[] key = Base64.getDecoder().decode(b64.trim());
            return key.length == 32 ? key : null;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    static byte[] derive(byte[] key, String label) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(label.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA256 không khả dụng", e);
        }
    }
}
