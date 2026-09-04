package com.deutschflow.vocabulary.galerie;

import java.util.Locale;

/**
 * 5 visual families của DeutschFlow Galerie (spec mục 13) — quyết định approach minh hoạ
 * của một từ trước khi sinh visualConcept.
 */
public enum GalerieFamily {

    /** Vật thể, đồ ăn, phương tiện, công cụ — standalone subject. */
    OBJEKT,
    /** Người, động vật, thực vật, nghề nghiệp — expressive silhouette. */
    LEBEN,
    /** Động từ, hành động, tương tác — pose + tối đa 2 chủ thể. */
    HANDLUNG,
    /** Địa điểm, công trình — một nét kiến trúc nhận diện được. */
    ORT,
    /** Cảm xúc, tính từ, khái niệm trừu tượng — visual metaphor phổ quát. */
    GEFUEHL_IDEE;

    /**
     * Parse khoan dung output LLM: chấp nhận biến thể có dấu/ký tự nối mà model hay trả về
     * ("GEFÜHL & IDEE", "gefühl_idee", "Gefuehl-Idee"...). Trả {@code null} nếu không khớp —
     * caller quyết định coi đó là lỗi parse.
     */
    public static GalerieFamily fromLlm(String raw) {
        if (raw == null) {
            return null;
        }
        String normalized = raw.trim()
                .toUpperCase(Locale.ROOT)
                .replace('Ü', 'U')
                .replaceAll("[^A-Z]+", "_")
                .replaceAll("^_+|_+$", "");
        return switch (normalized) {
            case "OBJEKT", "OBJECT" -> OBJEKT;
            case "LEBEN", "LIFE" -> LEBEN;
            case "HANDLUNG", "ACTION" -> HANDLUNG;
            case "ORT", "PLACE" -> ORT;
            case "GEFUHL_IDEE", "GEFUEHL_IDEE", "GEFUHL", "GEFUEHL", "IDEE", "EMOTION", "ABSTRACT" -> GEFUEHL_IDEE;
            default -> null;
        };
    }
}
