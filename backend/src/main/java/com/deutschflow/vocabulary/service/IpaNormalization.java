package com.deutschflow.vocabulary.service;

import java.util.Locale;

/**
 * Chuẩn hóa phiên âm IPA lưu trong DB dạng ngoặc vuông, ví dụ {@code [nˈɛːɜ]}.
 */
public final class IpaNormalization {

    private IpaNormalization() {}

    /**
     * Trả về chuỗi IPA có dạng {@code [...]}; null nếu rỗng/không hợp lệ.
     */
    public static String toBracketForm(String raw) {
        if (raw == null) {
            return null;
        }
        String t = raw.trim();
        if (t.isEmpty()) {
            return null;
        }
        if (t.startsWith("[") && t.endsWith("]")) {
            return t;
        }
        if (t.startsWith("/") && t.endsWith("/") && t.length() > 2) {
            return "[" + t.substring(1, t.length() - 1).trim() + "]";
        }
        return "[" + t + "]";
    }
}
