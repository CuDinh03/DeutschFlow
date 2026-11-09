package com.deutschflow.user.registration;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;

/**
 * Lõi mã PIN 6 số: sinh, băm, so. Không phụ thuộc bảng nào — dùng cho mã đăng ký và mã quên mật khẩu
 * ({@code PasswordResetService}, V366).
 *
 * <p><b>Vì sao HMAC có pepper chứ không SHA-256 trơn:</b> không gian mã chỉ 10⁶. Có SHA-256 trơn thì vét
 * cạn ngược ra mã trong chưa tới một giây, tức hash trơn không bảo vệ gì khi rò DB. Pepper nằm ngoài DB
 * (biến môi trường) nên rò DB vẫn không đọc ra mã. Ghép {@code pendingId} để hai hồ sơ trùng mã không
 * ra cùng một hash.
 */
public final class RegistrationCodes {

    public static final int CODE_LENGTH = 6;
    private static final SecureRandom RANDOM = new SecureRandom();

    private RegistrationCodes() {}

    /** 6 chữ số, đệm 0 bên trái. */
    public static String generate() {
        return String.format("%06d", RANDOM.nextInt(1_000_000));
    }

    /** HMAC-SHA256(pepper, pendingId + ":" + code), hex 64 ký tự. */
    public static String hash(byte[] pepper, long pendingId, String code) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(pepper, "HmacSHA256"));
            byte[] out = mac.doFinal((pendingId + ":" + code).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(out);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA256 không khả dụng", e);
        }
    }

    /** So hằng thời gian — không để thời gian phản hồi lộ bao nhiêu ký tự đầu khớp. */
    public static boolean matches(byte[] pepper, long pendingId, String code, String storedHash) {
        if (code == null || storedHash == null) return false;
        byte[] a = hash(pepper, pendingId, code).getBytes(StandardCharsets.US_ASCII);
        byte[] b = storedHash.trim().getBytes(StandardCharsets.US_ASCII);
        return MessageDigest.isEqual(a, b);
    }
}
