package com.deutschflow.curriculum.service;

import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Chín bài đã phát hành sửa ở V356 (ngày 31, 35, 39, 40, 51–55), kiểm trên DB thật sau Flyway:
 * các câu đã sửa mang đúng giá trị mới, và cả chín bài không còn lỗi cùng loại.
 */
@SpringBootTest
@DisplayName("sửa nội dung 9 bài A2/B1 đã phát hành (V356)")
class SuaNoiDungBaiA2B1IntegrationTest extends AbstractPostgresIntegrationTest {

    private static final int[] CHIN_BAI = {31, 35, 39, 40, 51, 52, 53, 54, 55};

    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private OpenAiChatClient chatClient;

    private JsonNode contentOfDay(int day) throws Exception {
        return objectMapper.readTree(jdbcTemplate.queryForObject(
                "SELECT content_json::text FROM skill_tree_nodes WHERE node_type = 'CORE_TRUNK' AND day_number = ?",
                String.class, day));
    }

    private List<JsonNode> exercises(JsonNode content) {
        List<JsonNode> items = new ArrayList<>();
        content.path("exercises").path("theory_gate").forEach(items::add);
        content.path("exercises").path("practice").forEach(items::add);
        return items;
    }

    private JsonNode item(int day, String id) throws Exception {
        return exercises(contentOfDay(day)).stream()
                .filter(e -> id.equals(e.path("id").asText()))
                .findFirst().orElseThrow();
    }

    private List<String> texts(JsonNode array) {
        List<String> out = new ArrayList<>();
        array.forEach(n -> out.add(n.asText()));
        return out;
    }

    /** Điền đáp án vào câu đề, bỏ phần gợi ý trong ngoặc: đọc được thành câu tiếng Đức hoàn chỉnh. */
    private String filled(JsonNode fillBlank) {
        String sentence = fillBlank.path("sentence_de").asText().replaceAll("\\s*\\(.*\\)$", "");
        for (String part : fillBlank.path("answer").asText().split(",\\s*")) {
            sentence = sentence.replaceFirst("___", part);
        }
        return sentence;
    }

    @Test
    @DisplayName("các bài REORDER đã sửa ghép lại đúng câu, đúng tập từ")
    void reorderDaSua() throws Exception {
        assertThat(String.join(" ", texts(item(35, "p35_02").path("correct_order"))))
                .isEqualTo("Er weiß, dass du krank bist.");
        assertThat(texts(item(35, "p35_02").path("words"))).contains("bist.").doesNotContain("ist.");

        assertThat(texts(item(51, "p51_02").path("words"))).contains("komme", "morgen.")
                .doesNotContain("komme.", "morgen");

        assertThat(texts(item(52, "p52_02").path("words"))).contains("hatten", "wir")
                .doesNotContain("hatte", "Wir");
    }

    @Test
    @DisplayName("ngày 52: câu phụ nachdem có động từ chia đứng cuối, đáp án chấm được theo thứ tự đó")
    void plusquamperfektTrongCauPhu() throws Exception {
        JsonNode tg03 = item(52, "tg52_03");
        JsonNode p03 = item(52, "p52_03");

        assertThat(filled(tg03)).isEqualTo("Nachdem sie die Prüfung bestanden hatte, feierte sie.");
        assertThat(filled(p03)).isEqualTo("Nachdem ich den Brief geschrieben hatte, schickte ich ihn ab.");
        assertThat(filled(item(52, "tg52_04"))).isEqualTo("Als ich aufwachte, war sie schon abgefahren.");

        String json = objectMapper.writeValueAsString(contentOfDay(52));
        Map<String, Object> dung = Map.of("tg52_03", "bestanden hatte", "p52_03", "geschrieben hatte");
        Map<String, Object> sai = Map.of("tg52_03", "hatte bestanden", "p52_03", "hatte geschrieben");
        assertThat(NodeExerciseGrader.grade(objectMapper, json, dung).correctCount()).isEqualTo(2);
        assertThat(NodeExerciseGrader.grade(objectMapper, json, sai).correctCount()).isZero();
    }

    @Test
    @DisplayName("tg51_04 chỉ còn một phương án sai, tg53_01 không còn hai lần nicht")
    void cauTracNghiemDaSua() throws Exception {
        JsonNode tg51 = item(51, "tg51_04");
        assertThat(tg51.path("question_vi").asText()).isEqualTo("Câu nào SAI ngữ pháp?");
        assertThat(texts(tg51.path("options")).get(tg51.path("correct").asInt())).isEqualTo("Er sagt, dass kommt er.");

        JsonNode tg53 = item(53, "tg53_01");
        assertThat(texts(tg53.path("options"))).noneMatch(o -> o.contains("nicht"));
        assertThat(texts(tg53.path("options")).get(tg53.path("correct").asInt())).isEqualTo("darfst");
    }

    @Test
    @DisplayName("các câu văn đã sửa nằm đúng chỗ, phần còn lại của bài giữ nguyên")
    void cauVanDaSua() throws Exception {
        assertThat(contentOfDay(31).path("audio_content").path("listen_dialogue").asText())
                .contains("Geh geradeaus", "nett von dir!");
        assertThat(contentOfDay(35).path("reading_passage").path("text_de").asText())
                .endsWith("weil mir die Zeit davonläuft.");
        assertThat(contentOfDay(39).path("examples").get(0).path("german").asText())
                .contains("Hätten Sie auch gern eine Vorspeise?");
        assertThat(contentOfDay(40).path("theory_cards").get(0).path("content").path("vi").asText())
                .contains("ich werde", "Partizip II");
        assertThat(contentOfDay(51).path("theory_cards").get(1).path("content").path("vi").asText())
                .contains("ich sei / du seist");
        assertThat(contentOfDay(51).path("phrases").get(0).path("speak_de").asText())
                .isEqualTo("Er sagt, er komme morgen.");
        assertThat(contentOfDay(52).path("examples").get(0).path("german").asText())
                .contains("Vorher war", "ging es ihm bereits besser.");
        assertThat(contentOfDay(52).path("vocabulary").get(0).path("ai_speech_hints").path("ipa_target").asText())
                .isEqualTo("naːxˈdeːm");
        assertThat(contentOfDay(53).path("examples").get(0).path("german").asText())
                .contains("Sie dürfen die Deadline nicht verpassen!");
        assertThat(contentOfDay(54).path("theory_cards").get(2).path("content").path("vi").asText())
                .contains("ich schreibe Ihnen wegen");
        assertThat(contentOfDay(54).path("reading_passage").path("text_de").asText())
                .contains("Herren,\n\nich schreibe Ihnen");

        assertThat(contentOfDay(52).path("reading_passage").path("text_de").asText()).startsWith("Ein langer Tag");
        assertThat(contentOfDay(52).path("theory_cards").size()).isEqualTo(3);
    }

    @Test
    @DisplayName("cả chín bài: REORDER cùng tập từ, FILL_BLANK đủ phần đáp án, làm đúng hết được 100%")
    void chinBaiNhatQuan() throws Exception {
        for (int day : CHIN_BAI) {
            JsonNode content = contentOfDay(day);
            Map<String, Object> answers = new HashMap<>();
            for (JsonNode item : exercises(content)) {
                String id = item.path("id").asText();
                switch (item.path("type").asText()) {
                    case "MULTIPLE_CHOICE" -> {
                        assertThat(item.path("correct").asInt()).as(id).isBetween(0, item.path("options").size() - 1);
                        answers.put(id, Map.of("choice", item.path("correct").asInt()));
                    }
                    case "FILL_BLANK" -> {
                        assertThat(filled(item)).as(id).doesNotContain("___");
                        assertThat(item.path("sentence_de").asText().split("___", -1).length - 1).as(id)
                                .isEqualTo(item.path("answer").asText().split(",\\s*").length);
                        answers.put(id, Map.of("text", item.path("answer").asText()));
                    }
                    case "REORDER" -> assertThat(texts(item.path("words"))).as(id)
                            .containsExactlyInAnyOrderElementsOf(texts(item.path("correct_order")));
                    default -> { }
                }
            }
            String json = objectMapper.writeValueAsString(content);
            assertThat(NodeExerciseGrader.grade(objectMapper, json, answers).percent()).as("điểm ngày %d", day).isEqualTo(100);
            assertThat(content.toString()).as("ngày %d", day)
                    .doesNotContain("ik sei", "ik werde", "ichm schreibe", "PartizipII", "Grüßen,");
        }
    }
}
