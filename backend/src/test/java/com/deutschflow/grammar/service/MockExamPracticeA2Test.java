package com.deutschflow.grammar.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Luyện đề telc A2 (Xưởng đề đợt 4): Teil Viết theo dạng, form chấm từng ô")
class MockExamPracticeA2Test {

    private final MockExamPracticeService service = new MockExamPracticeService(null, null, null, null);

    private static Map<String, Object> structure(List<Map<String, Object>> schreibenTeile) {
        return Map.of("sections", List.of(Map.of("name", "SCHREIBEN", "teile", schreibenTeile)));
    }

    @Test
    void writingKeyFollowsTeilKind() {
        Map<String, Object> form = Map.of("teil", 1, "type", "FILL_FORM",
                "form_fields", List.of(Map.of("field", "Ort", "answer", "Bremen")));
        Map<String, Object> note = Map.of("teil", 2, "type", "WRITE_NOTE", "prompt", "…");
        assertThat(service.writingKey(structure(List.of(form, note)))).isEqualTo("SCHREIBEN-2");
        assertThat(service.writingKey(structure(List.of(Map.of("teil", 1, "prompt", "B1 E-Mail"))))).isEqualTo("SCHREIBEN-1");
        assertThat(MockExamPracticeService.isFormTeil(form)).isTrue();
        assertThat(MockExamPracticeService.isFormTeil(note)).isFalse();
    }

    @Test
    @DisplayName("form 5 ô, 5 điểm: sai chính tả nhẹ vẫn đúng, số sai là sai, ô trống không trả lời")
    void formResultPerField() {
        Map<String, Object> form = Map.of("teil", 1, "type", "FILL_FORM", "max_points", 5, "form_fields", List.of(
                Map.of("field", "Kurstag", "answer", "Donnerstag", "accept", List.of("Do")),
                Map.of("field", "Telefon", "answer", "0421 55 66 77"),
                Map.of("field", "Ort", "answer", "Bremen"),
                Map.of("field", "Zahlung", "answer", "Überweisung"),
                Map.of("field", "Beginn", "answer", "3. Mai")));
        var r = MockExamPracticeService.formResult("SCHREIBEN-1", form, Map.of(
                "form_0", "Donerstach", "form_1", "0421 55 66 78", "form_2", "bremen", "form_4", "3 Mai"));
        assertThat(r.max()).isEqualTo(5.0);
        assertThat(r.score()).isEqualTo(3.0);
        assertThat(r.items()).extracting(PracticeAnalysis.ItemResult::id).containsExactly("form_0", "form_1", "form_2", "form_3", "form_4");
        assertThat(r.items().get(1).isCorrect()).isFalse();
        assertThat(r.items().get(3).answered()).isFalse();
        assertThat(r.items().get(0).correct()).isEqualTo("Donnerstag");
    }
}
