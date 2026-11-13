package com.deutschflow.vocabulary.saved;

import java.util.regex.Pattern;

/** Chuẩn hoá và kiểm chữ học viên bôi đen khi lưu từ. */
final class SavedWordText {

    static final int MAX_WORDS = 5;
    static final int MAX_SURFACE = 60;
    static final int MAX_SENTENCE = 500;

    /** 1–5 từ, mỗi từ bắt đầu bằng chữ cái; cho phép gạch nối và nháy đơn bên trong. */
    private static final Pattern SURFACE =
            Pattern.compile("^[\\p{L}][\\p{L}\\-'’]*(?: [\\p{L}][\\p{L}\\-'’]*){0," + (MAX_WORDS - 1) + "}$");

    private SavedWordText() {}

    /**
     * Gộp khoảng trắng, bỏ dấu câu / ngoặc / số ở hai đầu. Trả {@code null} nếu không còn là 1–5 từ hợp lệ.
     */
    static String normalizeSurface(String raw) {
        if (raw == null) return null;
        String s = raw.replaceAll("[\\s\\u00A0]+", " ").trim();
        s = s.replaceAll("^[^\\p{L}]+", "").replaceAll("[^\\p{L}]+$", "");
        if (s.isEmpty() || s.length() > MAX_SURFACE) return null;
        return SURFACE.matcher(s).matches() ? s : null;
    }

    /** Gộp khoảng trắng, cắt độ dài; rỗng ⇒ {@code null}. */
    static String normalizeSentence(String raw) {
        if (raw == null) return null;
        String s = raw.replaceAll("[\\s\\u00A0]+", " ").trim();
        if (s.isEmpty()) return null;
        return s.length() > MAX_SENTENCE ? s.substring(0, MAX_SENTENCE) : s;
    }
}
