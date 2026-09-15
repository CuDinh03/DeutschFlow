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
        assertThat(count("TELC", 3, "TASK_SITUATION")).isEqualTo(8);
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
}
