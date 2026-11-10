package com.deutschflow.user.mfa;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;

/**
 * Mã khôi phục 2FA: {@value #COUNT} mã mỗi lần phát, mỗi mã {@value #LENGTH} ký tự Base32 (50 bit ngẫu
 * nhiên), hiển thị {@code XXXXX-XXXXX}. Chỉ hiện cho người dùng MỘT lần; DB chỉ giữ
 * HMAC-SHA256(pepper, {@code "uid:<id>:<mã chuẩn hoá>"}) — pepper ở ngoài DB nên rò DB không dò ngược được
 * mã, và ghép user id để hai người trùng mã (xác suất ~0) không cùng một hash.
 *
 * <p>Chuẩn hoá khi nhập: bỏ khoảng trắng/gạch, viết hoa, và đổi các chữ số dễ nhầm sang chữ trong bảng
 * Base32 ({@code 0→O}, {@code 1→I}, {@code 8→B}) — bảng chữ không có 0/1/8 nên đổi vậy không gây trùng.
 */
public final class RecoveryCodes {

    public static final int COUNT = 10;
    public static final int LENGTH = 10;
    private static final char[] ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".toCharArray();
    private static final SecureRandom RNG = new SecureRandom();

    private RecoveryCodes() {}

    /** {@value #COUNT} mã mới, dạng hiển thị {@code XXXXX-XXXXX}. */
    public static List<String> generate() {
        List<String> codes = new ArrayList<>(COUNT);
        for (int i = 0; i < COUNT; i++) {
            StringBuilder sb = new StringBuilder(LENGTH + 1);
            for (int j = 0; j < LENGTH; j++) {
                if (j == LENGTH / 2) {
                    sb.append('-');
                }
                sb.append(ALPHABET[RNG.nextInt(ALPHABET.length)]);
            }
            codes.add(sb.toString());
        }
        return codes;
    }

    /** Dạng chuẩn để băm; {@code null} khi chuỗi không thể là mã khôi phục (sai độ dài/ký tự). */
    public static String normalize(String raw) {
        if (raw == null) {
            return null;
        }
        String s = raw.replaceAll("[\\s-]", "").toUpperCase(Locale.ROOT)
                .replace('0', 'O').replace('1', 'I').replace('8', 'B');
        if (s.length() != LENGTH) {
            return null;
        }
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            boolean ok = (c >= 'A' && c <= 'Z') || (c >= '2' && c <= '7');
            if (!ok) {
                return null;
            }
        }
        return s;
    }

    /** Hex HMAC-SHA256 của mã đã chuẩn hoá; {@code null} khi mã không hợp lệ. */
    public static String hash(byte[] pepper, long userId, String raw) {
        String normalized = normalize(raw);
        if (normalized == null) {
            return null;
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(pepper, "HmacSHA256"));
            byte[] out = mac.doFinal(("uid:" + userId + ":" + normalized).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(out);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA256 không khả dụng", e);
        }
    }
}
