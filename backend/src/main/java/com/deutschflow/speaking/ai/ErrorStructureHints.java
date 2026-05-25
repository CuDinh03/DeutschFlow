package com.deutschflow.speaking.ai;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Short German teaching labels for adaptive prompt "Schwerpunkt" section.
 */
public final class ErrorStructureHints {

    private static final Map<String, String> HINTS = new LinkedHashMap<>();

    static {
        HINTS.put("WORD_ORDER.V2_MAIN_CLAUSE", "Verb an Position 2 im Hauptsatz");
        HINTS.put("WORD_ORDER.SUBCLAUSE_VERB_FINAL", "Verb am Satzende im Nebensatz");
        HINTS.put("WORD_ORDER.INVERSION_AFTER_ADVERBIAL", "Inversion nach Adverbial am Satzanfang");
        HINTS.put("WORD_ORDER.NICHT_POSITION", "Position von \"nicht\"");
        HINTS.put("WORD_ORDER.TE_KA_MO_LO", "Te-Ka-Mo-Lo Wortstellung");
        HINTS.put("WORD_ORDER.MODAL_INF_END", "Modalverb + Infinitiv am Ende");
        HINTS.put("WORD_ORDER.SEparable_PREFIX_POSITION", "Trennbares Präfix (Position)");
        HINTS.put("CASE.PREP_DAT_MIT", "Präposition + Dativ (mit)");
        HINTS.put("CASE.PREP_AKK_FUER", "Präposition + Akkusativ (für)");
        HINTS.put("CASE.WECHSEL_AKK_VS_DAT", "Wechselpräposition Akk. vs. Dat.");
        HINTS.put("CASE.DATIVE_INDIRECT_OBJECT", "Dativ (indirektes Objekt)");
        HINTS.put("CASE.ACCUSATIVE_DIRECT_OBJECT", "Akkusativ (direktes Objekt)");
        HINTS.put("CASE.GENITIVE_REQUIRED", "Genitiv erforderlich");
        HINTS.put("ARTICLE.GENDER_WRONG_DER_DIE_DAS", "Genus: der/die/das");
        HINTS.put("ARTICLE.INDEFINITE_EIN_EINE", "Unbestimmter Artikel ein/eine");
        HINTS.put("ARTICLE.CASE_DECLENSION_DEM_DEN_DES", "Artikeldeklination (dem/den/des …)");
        HINTS.put("ARTICLE.PLURAL_DECLENSION", "Pluralartikel / Pluralform");
        HINTS.put("VERB.CONJ_PERSON_ENDING", "Verbkonjugation (Person/Endung)");
        HINTS.put("VERB.AUX_SEIN_HABEN_PERFEKT", "Perfekt: sein/haben + Partizip II");
        HINTS.put("VERB.PARTIZIP_II_FORM", "Partizip II Bildung");
        HINTS.put("VERB.MODAL_PERFEKT_DOUBLE_INF", "Modal + Perfekt / Doppelinfinitiv");
        HINTS.put("VERB.SEIN_HABEN_PRESENT", "sein/haben im Präsens");
        HINTS.put("AGREEMENT.SUBJECT_VERB_NUMBER", "Subjekt–Verb Kongruenz (Numerus)");
        HINTS.put("DECLENSION.ADJECTIVE_ENDING", "Adjektivendungen");
        HINTS.put("LEXICAL.FALSE_FRIEND_BEKOMMEN", "False Friend: bekommen vs. haben");
    }

    private ErrorStructureHints() {
    }

    public static String hintFor(String errorCode) {
        if (errorCode == null || errorCode.isBlank()) {
            return "";
        }
        return HINTS.getOrDefault(errorCode.trim(), errorCode.trim());
    }

    public static List<String> hintsFor(List<String> codes) {
        if (codes == null || codes.isEmpty()) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (String c : codes) {
            if (c != null && !c.isBlank()) {
                out.add(hintFor(c));
            }
        }
        return out;
    }
}
