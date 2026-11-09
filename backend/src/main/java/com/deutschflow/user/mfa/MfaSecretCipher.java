package com.deutschflow.user.mfa;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Mã hoá bí mật TOTP trước khi ghi DB: AES-256-GCM, IV ngẫu nhiên 12 byte mỗi lần, thẻ xác thực 128 bit.
 *
 * <p>Định dạng lưu: {@code v1:<keyId>:<base64(iv | ciphertext | tag)>}. {@code keyId} để sau này xoay khoá
 * (giải mã bằng khoá cũ, mã hoá lại bằng khoá mới) mà không phải đoán dòng nào dùng khoá nào.
 *
 * <p><b>AAD = user_id (8 byte big-endian).</b> Bí mật của người A chép sang dòng của người B sẽ KHÔNG giải
 * mã được — kẻ có quyền ghi DB (nhưng không có khoá) không "mượn" được 2FA của tài khoản khác.
 */
public final class MfaSecretCipher {

    static final String VERSION = "v1";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final SecureRandom RNG = new SecureRandom();

    private final String keyId;
    private final SecretKeySpec key;

    public MfaSecretCipher(String keyId, byte[] key) {
        if (key == null || key.length != 32) {
            throw new IllegalArgumentException("Khoá MFA phải đúng 32 byte (AES-256)");
        }
        if (keyId == null || keyId.isBlank() || keyId.contains(":")) {
            throw new IllegalArgumentException("keyId không hợp lệ");
        }
        this.keyId = keyId.trim();
        this.key = new SecretKeySpec(key.clone(), "AES");
    }

    public String keyId() {
        return keyId;
    }

    public String encrypt(long userId, byte[] plaintext) {
        try {
            byte[] iv = new byte[IV_BYTES];
            RNG.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            cipher.updateAAD(aad(userId));
            byte[] ct = cipher.doFinal(plaintext);
            byte[] out = ByteBuffer.allocate(iv.length + ct.length).put(iv).put(ct).array();
            return VERSION + ":" + keyId + ":" + Base64.getEncoder().encodeToString(out);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Không mã hoá được bí mật 2FA", e);
        }
    }

    /**
     * @throws IllegalStateException khi định dạng sai, keyId khác khoá đang nạp, sai khoá, sai AAD (dòng
     *                               của người khác) hoặc dữ liệu bị sửa — GCM không giải mã "gần đúng".
     */
    public byte[] decrypt(long userId, String stored) {
        if (stored == null) {
            throw new IllegalStateException("Thiếu bí mật 2FA");
        }
        String[] parts = stored.split(":", 3);
        if (parts.length != 3 || !VERSION.equals(parts[0])) {
            throw new IllegalStateException("Định dạng bí mật 2FA không hỗ trợ");
        }
        if (!keyId.equals(parts[1])) {
            throw new IllegalStateException("Bí mật 2FA mã hoá bằng khoá '" + parts[1] + "', khoá đang nạp là '" + keyId + "'");
        }
        try {
            byte[] raw = Base64.getDecoder().decode(parts[2]);
            if (raw.length <= IV_BYTES) {
                throw new IllegalStateException("Bí mật 2FA bị cắt cụt");
            }
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, raw, 0, IV_BYTES));
            cipher.updateAAD(aad(userId));
            return cipher.doFinal(raw, IV_BYTES, raw.length - IV_BYTES);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalStateException("Không giải mã được bí mật 2FA", e);
        }
    }

    private static byte[] aad(long userId) {
        return ByteBuffer.allocate(Long.BYTES).putLong(userId).array();
    }
}
