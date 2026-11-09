package com.deutschflow.user.mfa;

import java.io.ByteArrayOutputStream;
import java.util.Locale;

/**
 * Base32 theo RFC 4648 §6 (bảng chữ {@code A–Z2–7}), KHÔNG đệm {@code =} khi mã hoá — dạng mà ứng dụng
 * xác thực (Google Authenticator, 1Password, Authy…) đọc trong tham số {@code secret} của URI
 * {@code otpauth://}. Tự viết vì repo không có commons-codec; lớp nhỏ, có test với vectơ của RFC.
 *
 * <p>Giải mã dễ tính: bỏ khoảng trắng/gạch ngang/đệm {@code =}, chấp nhận chữ thường. Ký tự ngoài bảng
 * chữ → {@link IllegalArgumentException}.
 */
public final class Base32 {

    private static final char[] ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".toCharArray();
    private static final int[] LOOKUP = new int[128];

    static {
        java.util.Arrays.fill(LOOKUP, -1);
        for (int i = 0; i < ALPHABET.length; i++) {
            LOOKUP[ALPHABET[i]] = i;
        }
    }

    private Base32() {}

    public static String encode(byte[] data) {
        if (data == null || data.length == 0) {
            return "";
        }
        StringBuilder sb = new StringBuilder((data.length * 8 + 4) / 5);
        int buffer = 0;
        int bits = 0;
        for (byte b : data) {
            buffer = (buffer << 8) | (b & 0xFF);
            bits += 8;
            while (bits >= 5) {
                sb.append(ALPHABET[(buffer >> (bits - 5)) & 0x1F]);
                bits -= 5;
            }
        }
        if (bits > 0) {
            sb.append(ALPHABET[(buffer << (5 - bits)) & 0x1F]);
        }
        return sb.toString();
    }

    public static byte[] decode(String text) {
        if (text == null) {
            return new byte[0];
        }
        String clean = text.replaceAll("[\\s=-]", "").toUpperCase(Locale.ROOT);
        ByteArrayOutputStream out = new ByteArrayOutputStream(clean.length() * 5 / 8);
        int buffer = 0;
        int bits = 0;
        for (int i = 0; i < clean.length(); i++) {
            char c = clean.charAt(i);
            int v = c < 128 ? LOOKUP[c] : -1;
            if (v < 0) {
                throw new IllegalArgumentException("Ký tự Base32 không hợp lệ ở vị trí " + i);
            }
            buffer = (buffer << 5) | v;
            bits += 5;
            if (bits >= 8) {
                out.write((buffer >> (bits - 8)) & 0xFF);
                bits -= 8;
            }
        }
        return out.toByteArray();
    }
}
