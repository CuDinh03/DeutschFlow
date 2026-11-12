package com.deutschflow.examstudio;

import com.deutschflow.examstudio.ExamStudioDtos.Item;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Xưởng đề — hai câu cùng ý trong một Teil; sửa trùng nguồn theo đúng câu văn")
class TwinItemsAndOverlapRepairTest {

    private static Item item(String id, String question, String correctText) {
        return new Item(id, question, Map.of("a", correctText, "b", "etwas anderes steht hier", "c", "noch etwas anderes"),
                "a", null, null, List.of(), "EASY", null, false, null, List.of());
    }

    @Test
    @DisplayName("lượt #6: hai câu hỏi phiếu câu đố lấy ở đâu, khác cách ngắt câu ⇒ câu sau bị coi là trùng câu trước")
    void twinsFromRun6() {
        Map<String, String> twins = ExamDedupService.duplicatesWithin(List.of(
                item("LV2-6", "Am 24. Dezember 2026 …", "können Gäste den Markt nur bis zum frühen Abend besuchen."),
                item("LV2-7", "Den Fragebogen für das Quiz in der Weihnachtswelt …",
                        "holen sich Familien am offiziellen Souvenirstand beim Herzerlbaum ab."),
                item("LV2-8", "Die Weihnachtswelt im Rathauspark …", "ist ein Ort, an dem Kinder und Eltern selbst aktiv werden sollen."),
                item("LV2-9", "Den Fragebogen für das Quiz in der Weihnachtswelt holen sich Familien …",
                        "am offiziellen Souvenirstand beim Herzerlbaum ab.")));
        assertThat(twins).containsExactly(Map.entry("LV2-9", "LV2-7"));
    }

    @Test
    @DisplayName("câu khác ý không bị coi là trùng, kể cả khi cùng mở đầu; Lesen 1 (\"Text n\") so theo tiêu đề")
    void notTwins() {
        assertThat(ExamDedupService.duplicatesWithin(List.of(
                item("LV2-6", "Am Wochenende …", "schlafen viele Erwachsene länger als an Arbeitstagen."),
                item("LV2-7", "Am Wochenende …", "fahren weniger Menschen mit der Bahn in die Stadt."),
                item("LV1-1", "Text 1", "Mehr Menschen fahren mit dem Rad zur Arbeit"),
                item("LV1-2", "Text 2", "Neue Radwege in der Innenstadt geplant")))).isEmpty();
        // Câu không có nội dung thì không so.
        assertThat(ExamDedupService.duplicatesWithin(List.of(item("A", "", ""), item("B", " ", " ")))).isEmpty();
        // Giống hệt ⇒ trùng, dù rất ngắn.
        assertThat(ExamDedupService.duplicatesWithin(List.of(item("A", "Der Kurs …", "beginnt im Mai."),
                item("B", "Der Kurs …", "beginnt im Mai.")))).containsExactly(Map.entry("B", "A"));
    }

    @Test
    @DisplayName("sửa trùng nguồn: chỉ lấy đúng câu văn chứa đoạn trùng, kể cả khi đoạn trùng không có dấu câu của bài")
    void sentencesWithOverlap() {
        String context = "Im Jahr 2025 gab es in Hamburg mehr Übernachtungen als im Vorjahr. "
                + "Besonders viele Gäste kamen aus Dänemark, den Niederlanden und der Schweiz in die Stadt.\n\n"
                + "Die Hotels freuen sich über die Entwicklung. Kurz.";
        List<String> hit = ExamSetRunService.sentencesWith(context,
                List.of("Gäste kamen aus Dänemark den Niederlanden und der Schweiz"));
        assertThat(hit).containsExactly(
                "Besonders viele Gäste kamen aus Dänemark, den Niederlanden und der Schweiz in die Stadt.");
        // Mỗi câu tìm được phải nằm nguyên văn trong bài (điều kiện của thao tác "viết lại đoạn bôi đen").
        assertThat(hit).allSatisfy(s -> assertThat(context).contains(s));

        // Đoạn trùng vắt qua hai câu: lấy cả câu chứa phần đầu và câu chứa phần cuối.
        assertThat(ExamSetRunService.sentencesWith(context,
                List.of("mehr Übernachtungen als im Vorjahr Besonders viele Gäste kamen"))).hasSize(2);
        assertThat(ExamSetRunService.sentencesWith(context, List.of("ganz andere Wörter stehen hier drin"))).isEmpty();
        assertThat(ExamSetRunService.sentencesWith(context, List.of("zu kurz"))).isEmpty();
        assertThat(ExamSetRunService.sentencesWith(null, List.of("a b c d"))).isEmpty();
        assertThat(ExamSetRunService.sentencesWith(context, List.of())).isEmpty();
    }
}
