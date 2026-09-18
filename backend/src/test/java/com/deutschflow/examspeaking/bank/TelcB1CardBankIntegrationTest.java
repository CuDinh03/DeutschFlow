package com.deutschflow.examspeaking.bank;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Ngân hàng thẻ thi Nói telc B1 sau V326, đọc trên PostgreSQL thật.
 *
 * <p>Vì sao cần DB thật: V326 vừa CHÈN vừa <b>XOÁ</b> thẻ. Rủi ro nằm đúng ở câu xoá — nó phải bỏ
 * các thẻ Teil 3 dùng chung của telc mà KHÔNG chạm vào thẻ của Goethe, vốn do cùng một câu
 * `CROSS JOIN` trong V279 sinh ra. Đọc file SQL không chứng minh được điều đó.
 */
@SpringBootTest
@DisplayName("Ngân hàng thẻ thi Nói telc B1 (sau V326)")
class TelcB1CardBankIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private JdbcTemplate jdbc;

    private int count(String provider, int teilNo, String type) {
        Integer n = jdbc.queryForObject("""
                SELECT count(*) FROM speaking_exam_tasks
                WHERE provider = ? AND level = 'B1' AND teil_no = ? AND stimulus_json->>'type' = ?
                """, Integer.class, provider, teilNo, type);
        return n == null ? 0 : n;
    }

    @Test
    @DisplayName("Teil 2 trộn hai dạng Vorlage — không còn toàn biểu đồ")
    void teil2_mixesGraphicAndTextVorlage() {
        int graphic = count("TELC", 2, "TOPIC_GRAPHIC_PAIR");
        int text = count("TELC", 2, "TOPIC_TEXT_PAIR");

        assertThat(graphic).as("thẻ có biểu đồ").isGreaterThanOrEqualTo(8);
        assertThat(text).as("thẻ chỉ có đoạn văn — trước V326 là 0").isGreaterThanOrEqualTo(8);
        // Đề thật dùng đoạn văn là chính; luyện toàn biểu đồ là học tủ kỹ năng đọc biểu đồ.
        assertThat(text * 100 / (graphic + text))
                .as("tỉ lệ thẻ đoạn văn trong Teil 2 (%%)")
                .isBetween(40, 60);
    }

    @Test
    @DisplayName("Teil 3 dùng bộ thẻ RIÊNG, thôi dùng chung với Goethe")
    void teil3_hasItsOwnCards() {
        assertThat(count("TELC", 3, "PLANNING_CARD"))
                .as("thẻ dùng chung với Goethe B1 T1 phải biến mất khỏi telc")
                .isZero();
        // V326: 8 thẻ riêng; V330 (17/09): +6 theo danh mục tình huống đang ra → 14.
        assertThat(count("TELC", 3, "TASK_SITUATION")).isEqualTo(14);
    }

    @Test
    @DisplayName("MỌI thẻ Teil 3 đều bắt buộc phân công việc")
    void everyTeil3Card_requiresSplittingTheWork() {
        List<Map<String, Object>> cards = jdbc.queryForList("""
                SELECT id, stimulus_json::text AS json FROM speaking_exam_tasks
                WHERE provider = 'TELC' AND level = 'B1' AND teil_no = 3
                """);

        assertThat(cards).isNotEmpty();
        assertThat(cards).allSatisfy(card ->
                assertThat(String.valueOf(card.get("json")))
                        .as("thẻ %s phải có prompt phân công („wer welche Aufgaben übernimmt“)", card.get("id"))
                        .contains("Wer übernimmt welche Aufgabe?"));
    }

    @Test
    @DisplayName("HỒI QUY: thẻ của Goethe B1 Teil 1 KHÔNG bị câu xoá chạm tới")
    void goetheCards_areUntouched() {
        assertThat(count("GOETHE", 1, "PLANNING_CARD"))
                .as("cùng một CROSS JOIN ở V279 sinh ra thẻ cho cả hai hệ — xoá nhầm là mất đề Goethe")
                .isGreaterThanOrEqualTo(6);
    }


    // ── V330 (Gói D, 17/09/2026): dạng đề 2020 + rubric chính thức ─────────────────────────

    @Test
    @DisplayName("V330: Teil 2 có ≥ 8 thẻ ý kiến trái chiều (dạng 2020), mỗi thẻ đủ hai người có tên/tuổi/nghề/trích dẫn")
    void teil2_hasOpinionPairs_ofThe2020Format() {
        assertThat(count("TELC", 2, "TOPIC_OPINION_PAIR")).isGreaterThanOrEqualTo(8);
        Integer incomplete = jdbc.queryForObject("""
                SELECT count(*) FROM speaking_exam_tasks
                WHERE provider = 'TELC' AND level = 'B1' AND teil_no = 2 AND stimulus_json->>'type' = 'TOPIC_OPINION_PAIR'
                  AND NOT (stimulus_json->'candidateOpinion' ?& array['name','age','job','quote']
                           AND stimulus_json->'partnerOpinion' ?& array['name','age','job','quote']
                           AND stimulus_json ? 'thema' AND stimulus_json ? 'instruction')
                """, Integer.class);
        assertThat(incomplete).as("thẻ ý kiến thiếu trường").isZero();
    }

    @Test
    @DisplayName("V330: MỌI thẻ Teil 3 có câu lệnh bốn bước của đề thật (… wer welche Aufgabe übernimmt) và Zettel 3–5 mục")
    void everyTeil3Card_hasFourStepInstruction_andShortZettel() {
        List<Map<String, Object>> cards = jdbc.queryForList("""
                SELECT id, stimulus_json->>'instruction' AS instr,
                       jsonb_array_length(stimulus_json->'prompts') AS n
                FROM speaking_exam_tasks
                WHERE provider = 'TELC' AND level = 'B1' AND teil_no = 3
                """);

        assertThat(cards).hasSizeGreaterThanOrEqualTo(14);
        assertThat(cards).allSatisfy(card -> {
            assertThat(String.valueOf(card.get("instr"))).as("thẻ %s", card.get("id"))
                    .contains("Entscheiden Sie zuerst").contains("wer welche Aufgabe übernimmt");
            assertThat(((Number) card.get("n")).intValue()).as("Zettel thẻ %s", card.get("id")).isBetween(3, 5);
        });
    }

    @Test
    @DisplayName("V330: Teil 1 có ≥ 3 thẻ kiểu 2020 (Deutsch gelernt + Sprachen) kèm Zusatzfragen riêng của giám khảo")
    void teil1_has2020ContactCards_withPrivateExtraQuestions() {
        Integer n = jdbc.queryForObject("""
                SELECT count(*) FROM speaking_exam_tasks
                WHERE provider = 'TELC' AND level = 'B1' AND teil_no = 1 AND stimulus_json->>'type' = 'CONTACT_CARD'
                  AND stimulus_json::text LIKE '%Deutsch gelernt%'
                  AND stimulus_json::text LIKE '%Sprachen (welche? wie lange? warum?)%'
                  AND jsonb_array_length(stimulus_json->'partnerExtraQuestions') >= 1
                """, Integer.class);
        assertThat(n).isGreaterThanOrEqualTo(3);
        assertThat(count("TELC", 1, "CONTACT_CARD")).as("thẻ cũ giữ nguyên").isGreaterThanOrEqualTo(13);
    }

    @Test
    @DisplayName("V330: rubric telc B1 đúng Bewertungsbogen 2020 — bậc C = 1 (max 4) và 2 (max 8), Aussprache giữ 1/2, hết ghi chú nội suy")
    void rubric_telcB1_matchesOfficialBewertungsbogen() {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT (crit->>'code') AS code, (crit->>'max')::int AS max, (crit->'bandPoints'->>'C')::numeric AS c,
                       (crit->'bandPoints'->>'A')::numeric AS a, (crit->'bandPoints'->>'B')::numeric AS b
                FROM speaking_exam_blueprints b,
                     jsonb_array_elements(b.rubric_json->'parts') AS part,
                     jsonb_array_elements(part->'criteria') AS crit
                WHERE b.provider = 'TELC' AND b.level = 'B1'
                """);

        assertThat(rows).hasSize(12);
        assertThat(rows).allSatisfy(r -> {
            int max = ((Number) r.get("max")).intValue();
            double c = ((Number) r.get("c")).doubleValue();
            double expected = switch (max) { case 4 -> 1; case 8 -> 2; case 3 -> 1; case 6 -> 2; default -> -1; };
            assertThat(c).as("bậc C của %s (max %d)", r.get("code"), max).isEqualTo(expected);
            assertThat(((Number) r.get("a")).doubleValue()).isEqualTo(max);
        });
        String rubric = jdbc.queryForObject(
                "SELECT rubric_json::text FROM speaking_exam_blueprints WHERE provider = 'TELC' AND level = 'B1'", String.class);
        assertThat(rubric).doesNotContain("approximation").contains("Bewertungsbogen M10");
    }
}
