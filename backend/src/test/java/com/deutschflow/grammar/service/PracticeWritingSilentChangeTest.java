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

    /** Cặp bài thật từ prod 07/11/2026 (bản 653a4ad): mô hình viết hoa sau lời chào và xoá một câu của học viên. */
    static final String PROD_GOC = "Liebe Lena,\ndanke für deine E-Mail! Ich mich freue sehr, dass du Urlaub hast. Im Juli ich habe Zeit, nur am 15. Juli ich muss arbeiten. Du kannst gern kommen.\nMeine neue Stadt ist schön. Es gibt viele Parks und ein alter Markt. Am Wochenende ich gehe oft am Fluss spazieren.\nDu kannst in der Jugendherberge schlafen, sie kostet nur 25 Euro pro Nacht. Oder du schläfst bei mir auf dem Sofa.\nIch freue mich auf dich!\nLiebe Grüße\nMinh";
    static final String PROD_SUA = "Liebe Lena,\nDanke für deine E‑Mail! Ich freue mich sehr, dass du Urlaub hast. Im Juli habe ich Zeit, nur am 15. Juli muss ich arbeiten. Du kannst gern kommen.\nMeine neue Stadt ist schön. Es gibt viele Parks und ein alter Markt. Seit meinem Umzug habe ich einen neuen Job gefunden und lerne die Nachbarschaft kennen.\nDu kannst in der Jugendherberge schlafen, sie kostet nur 25 Euro pro Nacht. Oder du schläfst bei mir auf dem Sofa.\nIch freue mich auf dich!\nLiebe Grüße\nMinh";

    @Test
    void baiThatTuProd() {
        List<Map<String, Object>> notes = new java.util.ArrayList<>(List.of(
                note("Ich mich freue sehr", "Ich freue mich sehr"),
                note("Im Juli ich habe Zeit", "Im Juli habe ich Zeit"),
                note("nur am 15. Juli ich muss arbeiten", "nur am 15. Juli muss ich arbeiten"),
                note(null, "Seit meinem Umzug habe ich einen neuen Job gefunden und lerne die Nachbarschaft kennen.")));
        String sua = AiExamEvaluatorService.keepLowercaseAfterSalutation(PROD_GOC, PROD_SUA);
        // „Danke" sau „Liebe Lena," trả về chữ thường; gạch nối U+2011 coi như "-"
        assertThat(sua).startsWith("Liebe Lena,\ndanke für deine E‑Mail!");
        assertThat(AiExamEvaluatorService.silentChangeNotes(PROD_GOC, sua, notes)).isEmpty();
        // câu „Am Wochenende ich gehe …" bị thay mà không ghi chú nào nói tới ⇒ bài đã sửa không tin được
        assertThat(AiExamEvaluatorService.dropsStudentContent(PROD_GOC, sua, notes)).isTrue();
        // lỗi liền kề không dính thành một cụm: sửa ngầm „danke" (chữ hoa) vẫn tách ra được
        assertThat(AiExamEvaluatorService.silentChangeNotes(PROD_GOC, PROD_SUA, notes))
                .extracting(x -> x.get("quote")).containsExactly("danke");
    }

    @Test
    void baiDaSuaXoaCauCuaHocVienThiKhongTinDuoc() {
        String goc = "Hallo Lena,\nja, Juli ist gut. Komm! Du kannst bei mir wohnen. Tschüss, Minh";
        String sua = "Hallo Lena,\nja, Juli ist gut. Die Stadt gefällt mir sehr gut, sie hat viele schöne Parks und ein tolles Kulturangebot. Du kannst bei mir wohnen. Seit dem Umzug habe ich ein neues Büro. Tschüss, Minh";
        List<Map<String, Object>> notes = List.of(
                note(null, "Die Stadt gefällt mir sehr gut, sie hat viele schöne Parks und ein tolles Kulturangebot."),
                note(null, "Seit dem Umzug habe ich ein neues Büro."));
        assertThat(AiExamEvaluatorService.dropsStudentContent(goc, sua, notes)).isTrue();
        // chèn mà giữ „Komm!" thì vẫn tin được
        String suaGiu = sua.replace("gut. Die Stadt", "gut. Komm! Die Stadt");
        assertThat(AiExamEvaluatorService.dropsStudentContent(goc, suaGiu, notes)).isFalse();
    }

    @Test
    void cauSuaVietHoaSauLoiChaoThiTraChuThuong() {
        String goc = "Hallo Lena,\nvielen dank für deine mail. Bis bald";
        assertThat(AiExamEvaluatorService.lowercaseAfterSalutation(goc, "vielen dank für deine mail.", "Vielen Dank für deine Mail."))
                .isEqualTo("vielen Dank für deine Mail.");
        // không phải đầu dòng sau lời chào: giữ nguyên
        assertThat(AiExamEvaluatorService.lowercaseAfterSalutation(goc, "dank für", "Dank für")).isEqualTo("Dank für");
        // dòng đầu không kết thúc bằng dấu phẩy (vd. „Hallo Lena!"): viết hoa là đúng
        assertThat(AiExamEvaluatorService.lowercaseAfterSalutation("Hallo Lena!\nvielen Dank.", "vielen", "Vielen")).isEqualTo("Vielen");
    }

    @SuppressWarnings("unchecked")
    @Test
    void readAnnotationsBoGhiChuChiDoiVietHoaSauLoiChao() {
        String goc = "Hallo Lena,\nvielen Dank für deine Mail. Bis bald";
        String raw = """
                {"annotations": [
                  {"quote": "vielen Dank", "correction": "Vielen Dank", "category": "RECHTSCHREIBUNG", "why_vi": "Đầu câu viết hoa."}
                ], "musterloesung_de": "Hallo Lena,\\nVielen Dank für deine Mail. Bis bald"}""";
        Map<String, Object> eval = new LinkedHashMap<>();
        new AiExamEvaluatorService(null, null, null).readAnnotations(raw, goc, eval);
        assertThat((List<Map<String, Object>>) eval.get("annotations")).isEmpty();
        assertThat(eval.get("musterloesung")).isEqualTo(goc);
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
