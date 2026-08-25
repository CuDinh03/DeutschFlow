package com.deutschflow.examspeaking.weakness;

import java.util.Map;

/**
 * N1c-4: quy tắc ngắn (tiếng Việt) cho từng mã {@link com.deutschflow.speaking.ai.ErrorCatalog} —
 * fallback khi kho lỗi chưa có {@code ruleViShort} (mock/drill exam không yêu cầu LLM trả rule
 * để tiết kiệm token và tránh nhiễu). Tĩnh, 0 token, một nguồn duy nhất cho màn "Ôn yếu điểm".
 */
public final class ErrorRuleCatalog {

    private ErrorRuleCatalog() {}

    private static final Map<String, String> RULES_VI = Map.ofEntries(
            Map.entry("WORD_ORDER.V2_MAIN_CLAUSE", "Câu trần thuật: động từ chia luôn đứng vị trí 2."),
            Map.entry("WORD_ORDER.SUBCLAUSE_VERB_FINAL", "Mệnh đề phụ (weil, dass, wenn…): động từ chia đứng CUỐI câu."),
            Map.entry("WORD_ORDER.INVERSION_AFTER_ADVERBIAL", "Mở đầu bằng trạng ngữ (Heute, Dann…) → đảo: động từ trước, chủ ngữ sau."),
            Map.entry("WORD_ORDER.NICHT_POSITION", "\"nicht\" đứng trước thành phần bị phủ định; phủ định cả câu thì đứng gần cuối."),
            Map.entry("WORD_ORDER.TE_KA_MO_LO", "Thứ tự trạng ngữ: thời gian → nguyên nhân → cách thức → nơi chốn (TeKaMoLo)."),
            Map.entry("WORD_ORDER.MODAL_INF_END", "Động từ khuyết thiếu chia ở vị trí 2, động từ nguyên mẫu về CUỐI câu."),
            Map.entry("WORD_ORDER.SEparable_PREFIX_POSITION", "Động từ tách: tiền tố (an-, auf-, ein-…) tách ra đứng cuối câu."),
            Map.entry("CASE.PREP_DAT_MIT", "Sau \"mit\" luôn là Dativ: mit dem Bus, mit der U-Bahn."),
            Map.entry("CASE.PREP_AKK_FUER", "Sau \"für\" luôn là Akkusativ: für den Freund, für die Familie."),
            Map.entry("CASE.WECHSEL_AKK_VS_DAT", "Giới từ hai cách (in, an, auf…): hướng chuyển động → Akkusativ, vị trí đứng yên → Dativ."),
            Map.entry("CASE.DATIVE_INDIRECT_OBJECT", "Tân ngữ gián tiếp (cho ai) dùng Dativ: Ich gebe dem Kind das Buch."),
            Map.entry("CASE.ACCUSATIVE_DIRECT_OBJECT", "Tân ngữ trực tiếp (cái gì/ai) dùng Akkusativ: Ich sehe den Mann."),
            Map.entry("CASE.GENITIVE_REQUIRED", "Một số giới từ/cấu trúc đòi Genitiv: wegen des Wetters, trotz des Regens."),
            Map.entry("ARTICLE.GENDER_WRONG_DER_DIE_DAS", "Danh từ tiếng Đức có giống cố định — học từ mới luôn kèm der/die/das."),
            Map.entry("ARTICLE.INDEFINITE_EIN_EINE", "Mạo từ không xác định theo giống: ein (der/das), eine (die)."),
            Map.entry("ARTICLE.CASE_DECLENSION_DEM_DEN_DES", "Mạo từ biến đổi theo cách: den (Akk. giống đực), dem (Dat.), des (Gen.)."),
            Map.entry("ARTICLE.PLURAL_DECLENSION", "Số nhiều: die ở Nominativ/Akkusativ, den + đuôi -n ở Dativ."),
            Map.entry("VERB.CONJ_PERSON_ENDING", "Chia động từ theo ngôi: ich -e, du -st, er/sie/es -t, wir/sie -en."),
            Map.entry("VERB.AUX_SEIN_HABEN_PERFEKT", "Perfekt: động từ chuyển động/thay đổi trạng thái dùng \"sein\", còn lại dùng \"haben\"."),
            Map.entry("VERB.PARTIZIP_II_FORM", "Partizip II: ge- + thân + -t (yếu) / -en (mạnh); động từ -ieren không có ge-."),
            Map.entry("VERB.MODAL_PERFEKT_DOUBLE_INF", "Perfekt với khuyết thiếu: haben + động từ nguyên mẫu kép (Ich habe kommen müssen)."),
            Map.entry("VERB.SEIN_HABEN_PRESENT", "Chia \"sein\" (bin, bist, ist…) và \"haben\" (habe, hast, hat…) — học thuộc, không theo quy tắc."),
            Map.entry("AGREEMENT.SUBJECT_VERB_NUMBER", "Động từ phải khớp số với chủ ngữ: die Kinder spielen (không phải spielt)."),
            Map.entry("DECLENSION.ADJECTIVE_ENDING", "Đuôi tính từ theo mạo từ + giống + cách: der gute Mann, ein guter Mann."),
            Map.entry("LEXICAL.FALSE_FRIEND_BEKOMMEN", "\"bekommen\" = nhận được (không phải \"become\"); \"trở thành\" là \"werden\".")
    );

    /** Quy tắc VI ngắn cho mã lỗi; null nếu mã không có trong catalog. */
    public static String ruleVi(String errorCode) {
        return errorCode == null ? null : RULES_VI.get(errorCode);
    }
}
