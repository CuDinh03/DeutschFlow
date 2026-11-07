package com.deutschflow.grammar.service;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Lỗi gặp khi nghiệm thu chấm Viết telc trên production 07/11/2026: bài đã sửa đổi chỗ không có ghi
 * chú ("sửa ngầm"), câu quy tắc và mục Làm tốt bằng tiếng Đức.
 */
class PracticeWritingSilentChangeTest {

    private static final String BAI_A = """
            Liebe Lena,
            danke für deine E-Mail! Im Juli ich habe Zeit. Am Wochenende ich gehe oft am Fluss spazieren.
            Ich habe ab dem 10. Juli urlaub.
            Liebe Grüße
            Minh""";

    private static final String SUA_A = """
            Liebe Lena,
            danke für deine E-Mail! Im Juli habe ich Zeit. Am Wochenende gehe ich oft am Fluss spazieren.
            Ich habe ab dem 10. Juli Urlaub.
            Liebe Grüße
            Minh""";

    private static Map<String, Object> note(String quote, String correction) {
        Map<String, Object> a = new LinkedHashMap<>();
        a.put("quote", quote);
        a.put("correction", correction);
        return a;
    }

    @Test
    void doiChoTuVaVietHoaKhongCoGhiChuThiThemGhiChu() {
        List<Map<String, Object>> notes = List.of(note("Im Juli ich habe", "Im Juli habe ich"));

        List<Map<String, Object>> added = AiExamEvaluatorService.silentChangeNotes(BAI_A, SUA_A, notes);

        assertThat(added).extracting(n -> n.get("quote")).containsExactly("ich gehe", "urlaub.");
        assertThat(added.get(0)).containsEntry("correction", "gehe ich").containsEntry("category", "GRAMMATIK")
                .containsEntry("kriterium", "III").containsEntry("source", "MUSTER_DIFF");
        assertThat((String) added.get(0).get("whyVi")).contains("thứ tự từ");
        assertThat(added.get(1)).containsEntry("correction", "Urlaub.").containsEntry("category", "RECHTSCHREIBUNG");
    }

    @Test
    void choDaCoGhiChuHoacCauChenThemThiKhongThem() {
        String goc = "Hallo Lena, ja, Juli ist gut. Tschüss, Minh";
        String sua = "Hallo Lena, ja, Juli ist gut. Meine neue Stadt ist schön. Tschüss, Minh";
        // chỉ có câu chèn (ý thiếu) — việc của ghi chú thiếu ý, không phải sửa ngầm
        assertThat(AiExamEvaluatorService.silentChangeNotes(goc, sua, List.of())).isEmpty();

        // đã có ghi chú phủ đúng chỗ
        assertThat(AiExamEvaluatorService.silentChangeNotes(BAI_A, SUA_A, List.of(
                note("Im Juli ich habe", "Im Juli habe ich"),
                note("Am Wochenende ich gehe", "Am Wochenende gehe ich"),
                note("Juli urlaub.", "Juli Urlaub.")))).isEmpty();

        // bài giống hệt
        assertThat(AiExamEvaluatorService.silentChangeNotes(BAI_A, BAI_A, List.of())).isEmpty();
    }

    @Test
    void nhanDienTiengViet() {
        assertThat(AiExamEvaluatorService.looksVietnamese("Câu trần thuật: động từ chia luôn đứng vị trí 2.")).isTrue();
        assertThat(AiExamEvaluatorService.looksVietnamese("Đáp ứng đủ 4 điểm")).isTrue();
        assertThat(AiExamEvaluatorService.looksVietnamese("Nebensätze mit \"dass\" benötigen Komma davor.")).isFalse();
        assertThat(AiExamEvaluatorService.looksVietnamese("Gute inhaltliche Abdeckung aller Punkte")).isFalse();
        assertThat(AiExamEvaluatorService.looksVietnamese("Viele Cafés am Fluss")).isFalse();
        assertThat(AiExamEvaluatorService.looksVietnamese("")).isFalse();
        // câu quy tắc: mẫu ngắn tiếng Đức vẫn đọc được, câu văn tiếng Đức thì không
        assertThat(AiExamEvaluatorService.ruleReadable("zu + der → zur")).isTrue();
        assertThat(AiExamEvaluatorService.ruleReadable("ich möchte + Infinitiv")).isTrue();
        assertThat(AiExamEvaluatorService.ruleReadable("Nebensätze mit \"dass\" benötigen Komma davor.")).isFalse();
        assertThat(AiExamEvaluatorService.ruleReadable("")).isFalse();
    }

    @SuppressWarnings("unchecked")
    @Test
    void readAnnotationsBoQuyTacTiengDucVaThemGhiChuSuaNgam() {
        String raw = """
                {"annotations": [
                  {"quote": "Im Juli ich habe", "correction": "Im Juli habe ich", "category": "KOHAERENZ",
                   "kriterium": "III", "why_vi": "Sai trật tự từ.", "rule_vi": "Nebensätze mit dass benötigen ein Komma davor."}
                ],
                "musterloesung_de": %s}""".formatted(com.fasterxml.jackson.databind.node.TextNode.valueOf(SUA_A).toString());
        Map<String, Object> eval = new LinkedHashMap<>();

        new AiExamEvaluatorService(null, null, null).readAnnotations(raw, BAI_A, eval);

        List<Map<String, Object>> notes = (List<Map<String, Object>>) eval.get("annotations");
        assertThat(notes.get(0)).containsEntry("ruleVi", "");
        assertThat(notes).extracting(n -> n.get("quote")).containsExactly("Im Juli ich habe", "ich gehe", "urlaub.");
        assertThat(eval.get("musterloesung")).isEqualTo(SUA_A);
    }
}
