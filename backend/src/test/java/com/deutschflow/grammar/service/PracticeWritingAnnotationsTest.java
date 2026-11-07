package com.deutschflow.grammar.service;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PracticeWritingAnnotationsTest {

    private static final String TEXT = "Hallo Lena,\nich gratuliere dir zu der neuen Arbeit. Das ist toll. Bis bald, Tim";

    @Test
    void trichDanKhopBaiDuocGiuNguyenVan() {
        assertThat(AiExamEvaluatorService.exactPassage(TEXT, "zu der neuen Arbeit")).isEqualTo("zu der neuen Arbeit");
        // mô hình đổi hoa/thường: vẫn tô đúng đoạn GỐC trong bài
        assertThat(AiExamEvaluatorService.exactPassage(TEXT, "das ist toll.")).isEqualTo("Das ist toll.");
        assertThat(AiExamEvaluatorService.exactPassage(TEXT, "zur neuen Arbeit")).isNull();
        assertThat(AiExamEvaluatorService.exactPassage(TEXT, "  ")).isNull();
    }

    @SuppressWarnings("unchecked")
    @Test
    void docGhiChuVaBoTrichDanKhongCoTrongBai() {
        String raw = """
                ```json
                {"annotations": [
                  {"quote": "zu der neuen Arbeit", "correction": "zur neuen Arbeit", "category": "grammatik",
                   "kriterium": "III", "leitpunkt": null, "why_vi": "zu + der gộp thành zur.", "rule_vi": "zu + der → zur"},
                  {"quote": "", "insert_after": "Das ist toll.", "correction": "Was machst du dort genau?",
                   "category": "INHALT", "kriterium": "I", "leitpunkt": 4, "why_vi": "Thiếu câu hỏi về công việc."},
                  {"quote": "Ich wohne in Köln", "correction": "x", "category": "LAUNE", "kriterium": "IV", "why_vi": "Trích sai."},
                  {"quote": "", "correction": "", "why_vi": ""}
                ],
                "musterloesung_de": "Hallo Lena, ich gratuliere dir zur neuen Arbeit."}
                ```""";
        Map<String, Object> eval = new LinkedHashMap<>();

        new AiExamEvaluatorService(null, null, null).readAnnotations(raw, TEXT, eval);

        List<Map<String, Object>> notes = (List<Map<String, Object>>) eval.get("annotations");
        assertThat(notes).hasSize(3);
        assertThat(notes.get(0)).containsEntry("quote", "zu der neuen Arbeit").containsEntry("category", "GRAMMATIK")
                .containsEntry("kriterium", "III").containsEntry("ruleVi", "zu + der → zur");
        assertThat(notes.get(1)).containsEntry("quote", null).containsEntry("insertAfter", "Das ist toll.")
                .containsEntry("leitpunkt", 4);
        // trích dẫn không có trong bài, nhóm và tiêu chí lạ: giữ ghi chú, bỏ phần không tin được
        assertThat(notes.get(2)).containsEntry("quote", null).containsEntry("category", "GRAMMATIK")
                .containsEntry("kriterium", null);
        assertThat(eval.get("musterloesung")).isEqualTo("Hallo Lena, ich gratuliere dir zur neuen Arbeit.");
    }

    @Test
    void jsonHongThiTraDanhSachRong() {
        Map<String, Object> eval = new LinkedHashMap<>();
        new AiExamEvaluatorService(null, null, null).readAnnotations("không phải json", TEXT, eval);
        assertThat(eval.get("annotations")).isEqualTo(List.of());
        assertThat(eval.get("musterloesung")).isEqualTo("");
    }

    @SuppressWarnings("unchecked")
    @Test
    void boGhiChuMaNenVietTrungBanViet() {
        String raw = """
                {"annotations": [
                  {"quote": "Das ist toll.", "correction": "Das  ist toll.", "category": "GRAMMATIK", "why_vi": "Bịa."},
                  {"quote": "zu der neuen Arbeit", "correction": "zu der neuen arbeit", "category": "RECHTSCHREIBUNG", "why_vi": "Đổi hoa/thường là sửa thật, giữ."},
                  {"quote": "Bis bald, Tim", "correction": "Bis bald Tim", "category": "RECHTSCHREIBUNG", "why_vi": "Bỏ dấu phẩy là sửa thật, giữ."}
                ], "musterloesung_de": ""}""";
        Map<String, Object> eval = new LinkedHashMap<>();
        new AiExamEvaluatorService(null, null, null).readAnnotations(raw, TEXT, eval);
        List<Map<String, Object>> notes = (List<Map<String, Object>>) eval.get("annotations");
        assertThat(notes).extracting(n -> n.get("quote")).containsExactly("zu der neuen Arbeit", "Bis bald, Tim");
        assertThat(AiExamEvaluatorService.sameText("„Hallo“  Lena", "\"Hallo\" Lena")).isTrue();
    }

    @SuppressWarnings("unchecked")
    @Test
    void quyTacNguPhapCoMaCatalogLayTuErrorRuleCatalog() {
        String raw = """
                {"annotations": [
                  {"quote": "Das ist toll.", "correction": "Toll ist das.", "category": "GRAMMATIK",
                   "why_vi": "x", "rule_vi": "habe sau chủ ngữ", "error_code": "v2_main_clause"},
                  {"quote": "zu der neuen Arbeit", "correction": "zur neuen Arbeit", "category": "GRAMMATIK",
                   "why_vi": "x", "rule_vi": "zu + der → zur", "error_code": "KHONG_CO"},
                  {"quote": "Bis bald, Tim", "correction": "Bis bald! Tim", "category": "REGISTER",
                   "why_vi": "x", "rule_vi": "Lời chào cuối thư", "error_code": "WORD_ORDER.V2_MAIN_CLAUSE"}
                ]}""";
        Map<String, Object> eval = new LinkedHashMap<>();
        new AiExamEvaluatorService(null, null, null).readAnnotations(raw, TEXT, eval);
        List<Map<String, Object>> notes = (List<Map<String, Object>>) eval.get("annotations");
        assertThat(notes.get(0)).containsEntry("errorCode", "WORD_ORDER.V2_MAIN_CLAUSE")
                .containsEntry("ruleVi", "Câu trần thuật: động từ chia luôn đứng vị trí 2.");
        // mã lạ: không có câu catalog, giữ quy tắc của mô hình
        assertThat(notes.get(1)).containsEntry("errorCode", null).containsEntry("ruleVi", "zu + der → zur");
        // mã chỉ áp cho nhóm ngữ pháp
        assertThat(notes.get(2)).containsEntry("errorCode", null).containsEntry("ruleVi", "Lời chào cuối thư");
    }

    @Test
    void boBaiDaSuaKhiThemYMoi() {
        List<Map<String, Object>> notes = List.of(
                Map.of("correction", "zur neuen Arbeit", "quote", "zu der neuen Arbeit"));
        java.util.HashMap<String, Object> insert = new java.util.HashMap<>();
        insert.put("correction", "Was machst du dort genau?");
        insert.put("quote", null);
        List<Map<String, Object>> withInsert = List.of(notes.get(0), insert);

        String ok = "Hallo Lena, ich gratuliere dir zur neuen Arbeit. Das ist toll. Bis bald, Tim";
        assertThat(AiExamEvaluatorService.addsNewContent(TEXT, ok, notes)).isFalse();
        // câu chèn cho ý thiếu đã có trong ghi chú: được phép
        String okInsert = ok.replace("Das ist toll.", "Das ist toll. Was machst du dort genau?");
        assertThat(AiExamEvaluatorService.addsNewContent(TEXT, okInsert, withInsert)).isFalse();
        // thêm ý mới người học chưa viết
        String invented = ok + " Ich habe auch eine neue Wohnung in Hamburg gefunden und wir können am Wochenende zusammen ins Kino gehen.";
        assertThat(AiExamEvaluatorService.addsNewContent(TEXT, invented, notes)).isTrue();
    }

    @Test
    void readAnnotationsBoMusterloesungThemY() {
        String raw = """
                {"annotations": [], "musterloesung_de": "Hallo Lena, ich gratuliere dir zu der neuen Arbeit. Das ist toll. Ich habe auch eine neue Wohnung in Hamburg gefunden und wir gehen am Samstag zusammen ins Kino. Bis bald, Tim"}""";
        Map<String, Object> eval = new LinkedHashMap<>();
        new AiExamEvaluatorService(null, null, null).readAnnotations(raw, TEXT, eval);
        assertThat(eval.get("musterloesung")).isEqualTo("");
    }
}
