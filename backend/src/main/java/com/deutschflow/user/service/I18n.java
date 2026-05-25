package com.deutschflow.user.service;

/**
 * UI / lesson copy in Vietnamese, English, or German (German UI uses German explanations).
 */
public final class I18n {

    private I18n() {}

    public static String pick(String rawLang, String vi, String en, String de) {
        String l = rawLang == null ? "vi" : rawLang.trim().toLowerCase();
        if ("en".equals(l)) {
            return (en != null && !en.isBlank()) ? en : vi;
        }
        if ("de".equals(l)) {
            return (de != null && !de.isBlank()) ? de : vi;
        }
        return vi;
    }
}
