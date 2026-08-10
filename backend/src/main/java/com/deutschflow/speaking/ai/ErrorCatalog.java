package com.deutschflow.speaking.ai;

import java.util.Arrays;
import java.util.Locale;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Whitelist of MVP {@code error_code} values (aligned with STRATEGY_DeutschFlow.md Phụ lục A).
 */
public final class ErrorCatalog {

    /** Stable order for prompts and docs. */
    public static final String[] ORDERED_CODES = {
            "WORD_ORDER.V2_MAIN_CLAUSE",
            "WORD_ORDER.SUBCLAUSE_VERB_FINAL",
            "WORD_ORDER.INVERSION_AFTER_ADVERBIAL",
            "WORD_ORDER.NICHT_POSITION",
            "WORD_ORDER.TE_KA_MO_LO",
            "WORD_ORDER.MODAL_INF_END",
            "WORD_ORDER.SEparable_PREFIX_POSITION",
            "CASE.PREP_DAT_MIT",
            "CASE.PREP_AKK_FUER",
            "CASE.WECHSEL_AKK_VS_DAT",
            "CASE.DATIVE_INDIRECT_OBJECT",
            "CASE.ACCUSATIVE_DIRECT_OBJECT",
            "CASE.GENITIVE_REQUIRED",
            "ARTICLE.GENDER_WRONG_DER_DIE_DAS",
            "ARTICLE.INDEFINITE_EIN_EINE",
            "ARTICLE.CASE_DECLENSION_DEM_DEN_DES",
            "ARTICLE.PLURAL_DECLENSION",
            "VERB.CONJ_PERSON_ENDING",
            "VERB.AUX_SEIN_HABEN_PERFEKT",
            "VERB.PARTIZIP_II_FORM",
            "VERB.MODAL_PERFEKT_DOUBLE_INF",
            "VERB.SEIN_HABEN_PRESENT",
            "AGREEMENT.SUBJECT_VERB_NUMBER",
            "DECLENSION.ADJECTIVE_ENDING",
            "LEXICAL.FALSE_FRIEND_BEKOMMEN"
    };

    private static final Set<String> CODES;

    static {
        LinkedHashSet<String> s = new LinkedHashSet<>();
        Collections.addAll(s, ORDERED_CODES);
        CODES = Collections.unmodifiableSet(s);
    }

    private ErrorCatalog() {
    }

    public static boolean isValid(String code) {
        return code != null && !code.isBlank() && CODES.contains(code.trim());
    }

    /** UPPERCASE(mã đầy đủ) và UPPERCASE(hậu tố sau dấu chấm, nếu duy nhất) → mã chuẩn. */
    private static final java.util.Map<String, String> NORMALIZED_LOOKUP;

    static {
        java.util.Map<String, String> m = new java.util.HashMap<>();
        java.util.Set<String> ambiguousSuffixes = new java.util.HashSet<>();
        for (String c : ORDERED_CODES) {
            m.put(c.toUpperCase(Locale.ROOT), c);
            int dot = c.indexOf('.');
            if (dot >= 0) {
                String suffix = c.substring(dot + 1).toUpperCase(Locale.ROOT);
                if (m.containsKey(suffix) && !c.equals(m.get(suffix))) {
                    ambiguousSuffixes.add(suffix);
                } else {
                    m.put(suffix, c);
                }
            }
        }
        ambiguousSuffixes.forEach(m::remove);
        NORMALIZED_LOOKUP = Collections.unmodifiableMap(m);
    }

    /**
     * Đưa mã model trả về dạng chuẩn của catalog, hoặc {@code null} nếu không khớp.
     * Model hay trả sai định dạng chữ ({@code V2_main_clause}) hoặc thiếu tiền tố nhóm
     * ({@code V2_MAIN_CLAUSE} thay vì {@code WORD_ORDER.V2_MAIN_CLAUSE}) — trước đây các
     * lỗi THẬT này bị drop chỉ vì lệch định dạng (QA 09/08 mục G), mất dữ liệu cá nhân hoá.
     */
    public static String normalize(String code) {
        if (code == null || code.isBlank()) {
            return null;
        }
        String trimmed = code.trim();
        if (CODES.contains(trimmed)) {
            return trimmed;
        }
        return NORMALIZED_LOOKUP.get(trimmed.toUpperCase(Locale.ROOT));
    }

    /** Bullet list for system prompts (German instructions). */
    public static String codesBulletListForPrompt() {
        StringBuilder sb = new StringBuilder();
        for (String c : ORDERED_CODES) {
            sb.append("- ").append(c).append('\n');
        }
        return sb.toString();
    }

    /**
     * Comma-separated first {@code maxCodes} whitelist entries, breaking lines every {@code perLine} codes
     * to keep prompts readable while listing the full catalog when {@code maxCodes} is large enough.
     */
    public static String codesCompactForPrompt(int maxCodes, int perLine) {
        int n = Math.min(Math.max(1, maxCodes), ORDERED_CODES.length);
        int step = Math.max(1, perLine);
        String[] arr = Arrays.copyOfRange(ORDERED_CODES, 0, n);
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < arr.length; i++) {
            if (i > 0) {
                if (i % step == 0) {
                    sb.append('\n');
                } else {
                    sb.append(", ");
                }
            }
            sb.append(arr[i]);
        }
        return sb.toString();
    }

    /** Full whitelist (24 codes), four per line — compact vs bullets, complete for the model. */
    public static String codesCompactForPrompt() {
        return codesCompactForPrompt(ORDERED_CODES.length, 4);
    }
}
