package com.deutschflow.user.mfa;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.OptionalLong;

/**
 * TOTP theo RFC 6238 (dựng trên HOTP — RFC 4226): HMAC-SHA1, bước 30 giây, 6 chữ số — đúng bộ tham số
 * mặc định mà mọi ứng dụng xác thực hiểu khi URI {@code otpauth://} không nói gì thêm.
 *
 * <p>{@link #verify} nhận mã của bước hiện tại và ±{@value #DEFAULT_WINDOW} bước (lệch đồng hồ điện thoại
 * tới ~30 s), so HẰNG THỜI GIAN và LUÔN thử hết mọi bước trong cửa sổ (không thoát sớm) để thời gian phản
 * hồi không lộ mã khớp ở bước nào. Trả về bước khớp để người gọi chống phát lại
 * ({@code user_mfa.last_used_step}): một mã đã dùng thì không dùng lại được, kể cả còn trong cửa sổ.
 */
public final class Totp {

    public static final int STEP_SECONDS = 30;
    public static final int DIGITS = 6;
    public static final int DEFAULT_WINDOW = 1;
    /** Độ dài bí mật mới sinh: 20 byte = 160 bit, bằng đầu ra HMAC-SHA1 (RFC 4226 §4 khuyến nghị). */
    public static final int SECRET_BYTES = 20;

    private static final int[] POW10 = {1, 10, 100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000};

    private Totp() {}

    /** Bước thời gian (T trong RFC 6238) của một thời điểm. */
    public static long stepAt(Instant instant) {
        return Math.floorDiv(instant.getEpochSecond(), STEP_SECONDS);
    }

    /** Mã HOTP của {@code key} tại bộ đếm {@code step}, {@code digits} chữ số (đệm 0 bên trái). */
    public static String code(byte[] key, long step, int digits) {
        if (digits < 1 || digits > 8) {
            throw new IllegalArgumentException("digits phải trong 1..8");
        }
        byte[] hash = hmacSha1(key, ByteBuffer.allocate(8).putLong(step).array());
        return truncate(hash, digits);
    }

    /** Mã 6 số tại bước {@code step}. */
    public static String code(byte[] key, long step) {
        return code(key, step, DIGITS);
    }

    /**
     * Cắt động (dynamic truncation, RFC 4226 §5.3): lấy 4 byte bắt đầu ở vị trí do nibble cuối quyết định,
     * bỏ bit dấu, rồi lấy {@code digits} chữ số cuối.
     */
    static String truncate(byte[] hmac, int digits) {
        int offset = hmac[hmac.length - 1] & 0x0F;
        int binary = ((hmac[offset] & 0x7F) << 24)
                | ((hmac[offset + 1] & 0xFF) << 16)
                | ((hmac[offset + 2] & 0xFF) << 8)
                | (hmac[offset + 3] & 0xFF);
        int otp = binary % POW10[digits];
        StringBuilder sb = new StringBuilder(Integer.toString(otp));
        while (sb.length() < digits) {
            sb.insert(0, '0');
        }
        return sb.toString();
    }

    /**
     * Mã {@code candidate} có khớp bước nào trong {@code [nowStep - window, nowStep + window]} không.
     *
     * @return bước khớp (bước sớm nhất nếu — cực hiếm — hai bước cùng ra một mã), hoặc rỗng
     */
    public static OptionalLong verify(byte[] key, String candidate, long nowStep, int window) {
        if (candidate == null) {
            return OptionalLong.empty();
        }
        String typed = candidate.replaceAll("\\s", "");
        if (typed.length() != DIGITS || !typed.chars().allMatch(Character::isDigit)) {
            return OptionalLong.empty();
        }
        byte[] typedBytes = typed.getBytes(StandardCharsets.US_ASCII);
        long matched = Long.MIN_VALUE;
        for (long step = nowStep - window; step <= nowStep + window; step++) {
            byte[] expected = code(key, step).getBytes(StandardCharsets.US_ASCII);
            // Không break: mọi bước đều được tính, thời gian không phụ thuộc bước nào khớp.
            if (MessageDigest.isEqual(expected, typedBytes) && matched == Long.MIN_VALUE) {
                matched = step;
            }
        }
        return matched == Long.MIN_VALUE ? OptionalLong.empty() : OptionalLong.of(matched);
    }

    private static byte[] hmacSha1(byte[] key, byte[] message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(key, "HmacSHA1"));
            return mac.doFinal(message);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA1 không khả dụng", e);
        }
    }
}
