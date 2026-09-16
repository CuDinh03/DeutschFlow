package com.deutschflow.grammar.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bộ đề telc B1 phải khớp ĐÚNG bảng cấu trúc ở §1.2 của SRS module 07.
 *
 * <p>Vì sao cần một cổng riêng ngoài {@code MockExamSeedContentTest}: cổng chung kiểm những thứ
 * đúng cho mọi đề (đáp án nằm trong lựa chọn, id không trùng, có giải thích). Còn phân bố điểm của
 * telc thì rất dễ lệch mà vẫn "hợp lệ" — đổi một Teil từ 10 câu xuống 8 vẫn ra JSON đúng, chỉ có
 * điều phần đó tụt từ 25 xuống 20 và tổng không còn là 225. Sai kiểu đó không ai thấy bằng mắt.
 */
@DisplayName("Bộ đề telc B1 — khớp bảng cấu trúc của đề thật")
class MockExamTelcSeedTest {

    private static final ObjectMapper OM = new ObjectMapper();
    private static final Path SEED =
            Path.of("src/main/resources/db/migration/V325__mock_exam_telc_b1_set1.sql");

    private static Map<String, Object> exam;

    @BeforeAll
    static void loadSeed() throws IOException {
        Matcher m = Pattern.compile("\\$j\\$\\s*(\\{.*?\"sections\".*?})\\s*\\$j\\$", Pattern.DOTALL)
                .matcher(Files.readString(SEED));
        assertThat(m.find()).as("không trích được sections_json từ %s", SEED.getFileName()).isTrue();
        exam = OM.readValue(m.group(1), Map.class);
    }

    @Test
    @DisplayName("đúng 60 câu và đúng 225 điểm, chia theo đúng bảng §1.2")
    void structure_matchesOfficialTable() {
        // phần → (số câu, điểm mỗi câu) của từng Teil, theo đúng thứ tự trong đề.
        Map<String, List<int[]>> expected = new HashMap<>();
        expected.put("LESEN", List.of(new int[]{5, 50}, new int[]{5, 50}, new int[]{10, 25}));
        expected.put("SPRACHBAUSTEINE", List.of(new int[]{10, 15}, new int[]{10, 15}));
        expected.put("HOEREN", List.of(new int[]{5, 50}, new int[]{10, 25}, new int[]{5, 50}));

        int totalItems = 0;
        double totalPoints = 0;
        for (Object sectionObj : (List<?>) exam.get("sections")) {
            Map<?, ?> section = (Map<?, ?>) sectionObj;
            String name = String.valueOf(section.get("name"));
            List<?> teile = (List<?>) section.get("teile");
            double sectionPoints = 0;

            if (expected.containsKey(name)) {
                List<int[]> spec = expected.get(name);
                assertThat(teile).as("%s: số Teil", name).hasSize(spec.size());
                for (int i = 0; i < spec.size(); i++) {
                    Map<?, ?> teil = (Map<?, ?>) teile.get(i);
                    List<?> items = (List<?>) teil.get("items");
                    // point_per_item nhân 10 để so bằng số nguyên (2,5 đ ⇒ 25).
                    double ppi = ((Number) teil.get("point_per_item")).doubleValue();
                    assertThat(items).as("%s Teil %d: số câu", name, i + 1).hasSize(spec.get(i)[0]);
                    assertThat(Math.round(ppi * 10)).as("%s Teil %d: điểm mỗi câu", name, i + 1)
                            .isEqualTo(spec.get(i)[1]);
                    totalItems += items.size();
                    sectionPoints += items.size() * ppi;
                }
            } else {
                // Phần Viết: một bức thư, không có câu khách quan nào.
                assertThat(name).isEqualTo("SCHREIBEN");
                assertThat(teile).hasSize(1);
                sectionPoints = ((Number) section.get("max_points")).doubleValue();
            }
            assertThat(sectionPoints).as("%s: tổng điểm của phần", name)
                    .isEqualTo(((Number) section.get("max_points")).doubleValue());
            totalPoints += sectionPoints;
        }

        assertThat(totalItems).as("tổng số câu").isEqualTo(60);
        assertThat(totalPoints).as("tổng điểm phần viết").isEqualTo(225);
    }

    @Test
    @DisplayName("hai ngưỡng đỗ độc lập, cổng Nói lấy điểm từ ngoài đề giấy")
    void passRule_hasTwoIndependentGates() {
        Map<?, ?> passRule = (Map<?, ?>) exam.get("pass_rule");
        Map<?, ?> written = (Map<?, ?>) passRule.get("written");
        Map<?, ?> oral = (Map<?, ?>) passRule.get("oral");

        assertThat(written.get("max")).isEqualTo(225);
        assertThat(written.get("min")).isEqualTo(135);
        assertThat(written.get("sections"))
                .isEqualTo(List.of("LESEN", "SPRACHBAUSTEINE", "HOEREN", "SCHREIBEN"));

        assertThat(oral.get("max")).isEqualTo(75);
        assertThat(oral.get("min")).isEqualTo(45);
        assertThat(oral.get("source"))
                .as("đề giấy telc KHÔNG có phần Nói — điểm đến từ module luyện thi nói")
                .isEqualTo("SPEAKING_SESSION");
        assertThat(exam.get("sections").toString())
                .as("không được khai section SPRECHEN trong đề telc")
                .doesNotContain("SPRECHEN");
    }

    @Test
    @DisplayName("số lần nghe đúng đề thật: Teil 1 một lần, Teil 2–3 hai lần")
    void hoeren_playLimitsMatchRealExam() {
        List<?> teile = teileOf("HOEREN");
        assertThat(((Map<?, ?>) teile.get(0)).get("max_plays")).isEqualTo(1);
        assertThat(((Map<?, ?>) teile.get(1)).get("max_plays")).isEqualTo(2);
        assertThat(((Map<?, ?>) teile.get(2)).get("max_plays")).isEqualTo(2);
    }

    @Test
    @DisplayName("Hörverstehen Teil 2 là hội thoại HAI người — không phải một giọng đọc liền")
    void hoerenTeil2_isTwoSpeakerDialogue() {
        Map<?, ?> teil2 = (Map<?, ?>) teileOf("HOEREN").get(1);
        List<?> turns = (List<?>) teil2.get("audio_script");

        assertThat(turns).as("phải là mảng lượt nói").hasSizeGreaterThanOrEqualTo(6);
        assertThat(turns.stream().map(t -> ((Map<?, ?>) t).get("speaker")).distinct())
                .as("phải có đúng hai vai để ra hai giọng").hasSize(2);
        assertThat(turns.stream().allMatch(t -> ((Map<?, ?>) t).get("name") != null))
                .as("mỗi lượt phải có tên người nói — fallback một giọng vẫn cần nhãn trên màn hình")
                .isTrue();
    }

    @Test
    @DisplayName("bốn khối thời gian 90 · nghỉ 20 · 30 · 30")
    void blocks_matchRealExamTiming() {
        List<?> blocks = (List<?>) exam.get("blocks");
        assertThat(blocks.stream().map(b -> ((Map<?, ?>) b).get("minutes")).toList())
                .isEqualTo(List.of(90, 20, 30, 30));
    }

    @Test
    @DisplayName("phần Viết có đúng bốn Leitpunkte — tiêu chí I chấm theo số ý này")
    void schreiben_hasFourLeitpunkte() {
        Map<?, ?> teil = (Map<?, ?>) teileOf("SCHREIBEN").get(0);
        assertThat((List<?>) teil.get("writing_points")).hasSize(4);
        assertThat(teil.get("prompt")).asString().isNotBlank();
    }

    private List<?> teileOf(String sectionName) {
        for (Object sectionObj : (List<?>) exam.get("sections")) {
            Map<?, ?> section = (Map<?, ?>) sectionObj;
            if (sectionName.equals(section.get("name"))) return (List<?>) section.get("teile");
        }
        throw new AssertionError("không có phần " + sectionName);
    }
}
