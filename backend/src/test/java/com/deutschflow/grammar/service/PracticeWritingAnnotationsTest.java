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
}
