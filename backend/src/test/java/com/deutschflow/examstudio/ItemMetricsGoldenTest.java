package com.deutschflow.examstudio;

import com.deutschflow.examstudio.ExamStudioDtos.Item;
import com.deutschflow.examstudio.ExamStudioDtos.Scores;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bộ câu chuẩn (người gán bậc) cho phần đo độ khó bằng code. Mỗi lần đổi ngưỡng trong {@link ItemMetrics}
 * hay công thức bậc, chạy test này để biết phép đo còn khớp nhãn người hay không.
 */
@DisplayName("Xưởng đề — đo độ khó bằng code trên bộ câu chuẩn")
class ItemMetricsGoldenTest {

    private static final ObjectMapper OM = new ObjectMapper();
    private static String context;
    private static final List<Item> items = new ArrayList<>();
    private static final Map<String, String> human = new LinkedHashMap<>();

    @BeforeAll
    static void load() throws Exception {
        try (InputStream in = ItemMetricsGoldenTest.class.getResourceAsStream("/exam-studio/golden-items-lesen2.json")) {
            JsonNode root = OM.readTree(in);
            context = root.path("context").asText();
            for (JsonNode n : root.path("items")) {
                Map<String, String> options = new LinkedHashMap<>();
                n.path("options").fields().forEachRemaining(e -> options.put(e.getKey(), e.getValue().asText()));
                items.add(new Item(n.path("id").asText(), n.path("question").asText(), options,
                        n.path("correct").asText(), "", n.path("evidence").asText(), List.of(), "EXPERT", null,
                        false, null, List.of()));
                human.put(n.path("id").asText(), n.path("level").asText());
            }
        }
        assertThat(items).isNotEmpty();
    }

    private static Item item(String id) {
        return items.stream().filter(i -> i.id().equals(id)).findFirst().orElseThrow();
    }

    @Test
    @DisplayName("bậc người gán luôn nằm trong khoảng [sàn, trần] mà code đo ra")
    void humanLevelWithinMeasuredBounds() {
        for (Item it : items) {
            ItemMetrics.Measured m = ItemMetrics.measure(context, it);
            String label = human.get(it.id());
            assertThat(m.evidenceFound()).as("%s: câu bằng chứng phải nằm nguyên văn trong bài", it.id()).isTrue();
            assertThat(ItemRules.rank(ItemMetrics.ceiling(m))).as("%s: trần %s, người gán %s", it.id(),
                    ItemMetrics.ceiling(m), label).isGreaterThanOrEqualTo(ItemRules.rank(label));
            assertThat(ItemRules.rank(ItemMetrics.floor(m))).as("%s: sàn %s, người gán %s", it.id(),
                    ItemMetrics.floor(m), label).isLessThanOrEqualTo(ItemRules.rank(label));
        }
    }

    @Test
    @DisplayName("câu chép gần nguyên một câu của bài: không thể vượt bậc Vừa dù AI chấm bao nhiêu")
    void copiedSentenceIsCappedAtMedium() {
        ItemMetrics.Measured m = ItemMetrics.measure(context, item("LV2-6"));
        assertThat(m.evidence()).isZero();
        assertThat(m.phrasing()).isZero();
        assertThat(m.multiParagraph()).isFalse();
        assertThat(ItemMetrics.ceiling(m)).isEqualTo("MEDIUM");
        // Lượt AI chấm 11/11/2026 cho câu này 6/8 (Khó). Ghép điểm code + điểm AI tối đa cho hai yếu tố còn lại:
        Scores combined = new Scores(m.phrasing(), m.evidence(), 2, 2);
        assertThat(ItemRules.levelOf(combined, m.multiParagraph(), true)).isEqualTo("MEDIUM");
    }

    @Test
    @DisplayName("đếm đúng số đoạn chứa bằng chứng")
    void countsEvidenceParagraphs() {
        assertThat(ItemMetrics.measure(context, item("LV2-8")).evidenceParagraphs()).containsExactly(2, 3);
        assertThat(ItemMetrics.measure(context, item("LV2-9")).evidenceParagraphs()).containsExactly(4, 6);
        ItemMetrics.Measured oneParagraph = ItemMetrics.measure(context, item("LV2-10"));
        assertThat(oneParagraph.evidenceParagraphs()).containsExactly(2);
        assertThat(oneParagraph.evidence()).isEqualTo(1);
    }

    @Test
    @DisplayName("câu trích không có trong bài ⇒ evidenceFound = false, không đoán số đoạn")
    void inventedEvidence() {
        Item base = item("LV2-6");
        Item fake = new Item(base.id(), base.question(), base.options(), base.correct(), "",
                "Dieser Satz steht nirgends im Text der Aufgabe.", List.of(), "HARD", null, false, null, List.of());
        ItemMetrics.Measured m = ItemMetrics.measure(context, fake);
        assertThat(m.evidenceFound()).isFalse();
        assertThat(ItemMetrics.ceiling(m)).isEqualTo("EXPERT");
    }

    @Test
    @DisplayName("lời nhắc sinh lại: giao Siêu khó mà bằng chứng gói trong một câu; câu hỏi có dấu hỏi")
    void recipeHints() throws Exception {
        JsonNode copied = OM.readTree("""
                {"question": "Menschen mit niedriger Bildung …",
                 "options": [{"text": "litten stärker unter Stress.", "correct": true},
                             {"text": "hatten gar keinen Stress.", "correct": false},
                             {"text": "wohnten häufiger auf dem Land.", "correct": false}],
                 "evidence": "Auch Menschen mit niedriger oder mittlerer Bildung litten stärker unter Stress."}""");
        assertThat(ExamDraftService.recipeHint(context, copied, "EXPERT")).contains("ZWEI verschiedenen Absätzen");
        assertThat(ExamDraftService.recipeHint(context, copied, "EASY")).isNull();

        JsonNode asQuestion = OM.readTree("""
                {"question": "Welche Gruppe hatte mehr Stress?",
                 "options": [{"text": "litten stärker unter Stress.", "correct": true},
                             {"text": "hatten gar keinen Stress.", "correct": false},
                             {"text": "wohnten häufiger auf dem Land.", "correct": false}],
                 "evidence": "Auch Menschen mit niedriger oder mittlerer Bildung litten stärker unter Stress."}""");
        assertThat(ExamDraftService.recipeHint(context, asQuestion, "EASY")).contains("Kein Fragesatz");
        assertThat(ExamDraftService.isSentenceStem("Am Wochenende …")).isTrue();
        assertThat(ExamDraftService.isSentenceStem("Was machen viele am Wochenende?")).isFalse();
    }

    @Test
    @DisplayName("dạng quá khứ / phân từ của động từ mạnh về đúng nguyên mẫu (kể cả có tiền tố)")
    void strongVerbLemmas() {
        assertThat(StrongVerbForms.lemmas("litten")).contains("leiden");
        assertThat(StrongVerbForms.lemmas("traten")).contains("treten");
        assertThat(StrongVerbForms.lemmas("auftraten")).containsSubsequence("auftreten", "treten");
        assertThat(StrongVerbForms.lemmas("begann")).contains("beginnen");
        assertThat(StrongVerbForms.lemmas("empfahlen")).contains("empfehlen");
        assertThat(StrongVerbForms.lemmas("vergessenen")).contains("vergessen");
        assertThat(StrongVerbForms.lemmas("geschrieben")).contains("schreiben");
        assertThat(StrongVerbForms.lemmas("Strategien")).doesNotContain("Strategie", "strategie");
        assertThat(StrongVerbForms.lemmas("jüngsten")).contains("jung");
        assertThat(StrongVerbForms.lemmas("liebsten")).contains("lieb");
        assertThat(StrongVerbForms.lemmas("frühzeitiges")).contains("frühzeitig");
    }

    @Test
    @DisplayName("bài nhiều đoạn vụn được gộp các đoạn kề nhau ngắn nhất, giữ thứ tự câu")
    void mergesShortParagraphs() {
        List<String> ten = new ArrayList<>();
        for (int i = 1; i <= 10; i++) ten.add("Satz " + i + " eins. Satz " + i + " zwei.");
        List<String> merged = ExamDraftService.mergeShortParagraphs(ten, 6);
        assertThat(merged).hasSize(6);
        assertThat(String.join(" ", merged)).isEqualTo(String.join(" ", ten));
        List<String> five = ten.subList(0, 5);
        assertThat(ExamDraftService.mergeShortParagraphs(five, 6)).isEqualTo(five);
    }

    @Test
    @DisplayName("bỏ markdown của model: chữ đậm thành thường, dấu sao chú thích đứng sau từ")
    void plainText() {
        assertThat(ExamDraftService.plainText("**Wie verbreitet Stress ist, zeigt die Analyse.**"))
                .isEqualTo("Wie verbreitet Stress ist, zeigt die Analyse.");
        assertThat(ExamDraftService.plainText("Förderung kann *präventiv* wirken."))
                .isEqualTo("Förderung kann präventiv* wirken.");
        assertThat(ExamDraftService.plainText("Das wirkt vorbeugend* und hilft.")).isEqualTo("Das wirkt vorbeugend* und hilft.");
    }

    @Test
    @DisplayName("các prompt có tham số vẫn format được (không có dấu % lạc)")
    void promptsFormat() {
        assertThat(ExamStudioAi.ITEMS_SYSTEM.formatted("B1", "B1")).contains("BAUPLAN").contains("QUALITÄT");
        assertThat(ExamStudioAi.TEXT_SYSTEM.formatted("B1", 300, 450, "B1")).contains("MINDESTENS 300");
        assertThat(ExamStudioAi.RUBRIC_SYSTEM.formatted("B1")).contains("supported");
        assertThat(ExamStudioAi.ITEMS_T1_SYSTEM.formatted("B1", "B1")).isNotBlank();
        assertThat(ExamStudioAi.TEXT_T1_SYSTEM.formatted("B1", 55, 110, "B1", ExamStudioAi.T1_SAME_FIELD_RULE))
                .contains("im selben Themenfeld");
        assertThat(ExamStudioAi.TEXT_T1_SYSTEM.formatted("B1", 55, 110, "B1", ExamStudioAi.T1_MIXED_RULE))
                .contains("GENAU EINE Quelle").doesNotContain("im selben Themenfeld");
    }
}
