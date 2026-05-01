package com.deutschflow.speaking.ai;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Post-processes model-provided structured errors to avoid stale/hallucinated entries.
 *
 * Principles:
 * - Never keep an error whose spans do not occur in the current user message.
 * - Normalize a few high-frequency preposition/case patterns (e.g. "mit den" -> CASE.PREP_DAT_MIT).
 * - Cap to 3 items (prompt contract).
 */
public final class AiErrorSanitizer {

    private AiErrorSanitizer() {}

    public static List<ErrorItem> sanitize(String userMessage, List<ErrorItem> raw) {
        if (raw == null || raw.isEmpty()) return List.of();
        String msg = userMessage == null ? "" : userMessage;
        String msgLower = msg.toLowerCase(Locale.ROOT);

        List<ErrorItem> out = new ArrayList<>();
        for (ErrorItem e : raw) {
            if (e == null) continue;
            String code = normalizeCode(msgLower, e.errorCode());
            if (code == null || !ErrorCatalog.isValid(code)) continue;

            String wrong = trimToNull(e.wrongSpan());
            String corrected = trimToNull(e.correctedSpan());

            // Drop stale spans: if provided spans don't appear in current message, it's likely hallucinated.
            if (wrong != null && !containsIgnoreCase(msg, wrong)) {
                // allow corrected span to be used as evidence only if it appears in msg (rare but possible)
                if (corrected == null || !containsIgnoreCase(msg, corrected)) {
                    continue;
                }
            }

            // Drop non-errors that explicitly say it's correct (we saw this in real runs).
            if (corrected != null && corrected.toLowerCase(Locale.ROOT).contains("korrekt")) {
                continue;
            }

            // Drop trivial duplicates: corrected == wrong
            if (wrong != null && corrected != null && wrong.equalsIgnoreCase(corrected)) {
                continue;
            }

            out.add(new ErrorItem(
                    code,
                    e.severity(),
                    e.confidence(),
                    wrong,
                    corrected,
                    e.ruleViShort(),
                    e.exampleCorrectDe()
            ));
            if (out.size() >= 3) break;
        }
        return out;
    }

    private static String normalizeCode(String msgLower, String codeRaw) {
        String code = trimToNull(codeRaw);
        if (code == null) return null;

        // Fix common mislabel: "mit" is dative; model sometimes outputs CASE.PREP_AKK_FUER.
        if (msgLower.contains(" mit dem ") || msgLower.contains(" mit den ")
                || msgLower.contains(" mit der ") || msgLower.contains(" mit einem ")
                || msgLower.contains(" mit einer ")) {
            if (!"CASE.PREP_DAT_MIT".equalsIgnoreCase(code)) {
                return "CASE.PREP_DAT_MIT";
            }
        }

        return code.trim();
    }

    private static boolean containsIgnoreCase(String haystack, String needle) {
        if (haystack == null || needle == null) return false;
        return haystack.toLowerCase(Locale.ROOT).contains(needle.toLowerCase(Locale.ROOT));
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isBlank() ? null : t;
    }
}

