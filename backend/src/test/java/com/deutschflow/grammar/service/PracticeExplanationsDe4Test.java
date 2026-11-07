package com.deutschflow.grammar.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Giải thích Đề 4 (V361) khớp nội dung đề (V345) — không cần DB: đọc thẳng hai file migration.
 * Kiểm: mọi id có trong đề; `evidence` chép nguyên văn (giao diện tô theo chuỗi); phương án sai có
 * trong lựa chọn và không phải đáp án; Teil Đọc/Sprachbausteine nào cũng có giải thích.
 */
class PracticeExplanationsDe4Test {

    private static final ObjectMapper OM = new ObjectMapper();
    private static final Pattern BLOCK = Pattern.compile("\\$j\\$\\s*(\\{.*?})\\s*\\$j\\$", Pattern.DOTALL);
    private static final Pattern TEIL_KEY = Pattern.compile("SELECT id, '([A-Z]+-\\d)'");

    private static JsonNode exam;
    private static final Map<String, JsonNode> explanations = new HashMap<>();

    @BeforeAll
    static void load() throws IOException {
        exam = OM.readTree(firstBlock(read("db/migration/V345__mock_exam_telc_b1_set4_nhap.sql")));
        String sql = read("db/migration/V361__giai_thich_luyen_de_telc_b1_de4.sql");
        for (String stmt : sql.split("ON CONFLICT")) {
            Matcher k = TEIL_KEY.matcher(stmt);
            Matcher b = BLOCK.matcher(stmt);
            if (k.find() && b.find()) explanations.put(k.group(1), OM.readTree(b.group(1)));
        }
    }

    @Test
    void moiTeilDocVaSprachbausteineDeuCoGiaiThich() {
        assertThat(explanations.keySet()).containsExactlyInAnyOrder(
                "LESEN-1", "LESEN-2", "LESEN-3", "SPRACHBAUSTEINE-1", "SPRACHBAUSTEINE-2");
    }

    @Test
    void giaiThichKhopDe() {
        List<String> problems = new ArrayList<>();
        int[] checked = {0, 0}; // evidence, wrong
        for (JsonNode section : exam.path("sections")) {
            String name = section.path("name").asText();
            for (JsonNode teil : section.path("teile")) {
                String key = name + "-" + teil.path("teil").asInt();
                JsonNode body = explanations.get(key);
                if (body == null) continue;
                String source = teilText(teil);
                JsonNode options = teil.has("headlines") ? teil.get("headlines")
                        : teil.has("ads") ? teil.get("ads") : teil.get("word_bank");
                Map<String, JsonNode> items = new HashMap<>();
                teil.path("items").forEach(it -> items.put(it.path("id").asText(), it));

                for (Iterator<Map.Entry<String, JsonNode>> it = body.path("items").fields(); it.hasNext(); ) {
                    var e = it.next();
                    JsonNode item = items.get(e.getKey());
                    if (item == null) { problems.add(key + ": id lạ " + e.getKey()); continue; }
                    for (JsonNode ev : e.getValue().path("evidence")) {
                        checked[0]++;
                        if (!source.contains(ev.asText())) problems.add(e.getKey() + ": evidence không có trong đề: " + ev.asText());
                    }
                    String correct = item.path("correct").asText();
                    JsonNode opts = item.has("options") ? item.get("options") : options;
                    for (Iterator<String> w = e.getValue().path("wrong").fieldNames(); w.hasNext(); ) {
                        String letter = w.next();
                        checked[1]++;
                        if (letter.equals(correct)) problems.add(e.getKey() + ": wrong." + letter + " là đáp án");
                        if (opts == null || !opts.has(letter)) problems.add(e.getKey() + ": wrong." + letter + " không có trong lựa chọn");
                    }
                }
                for (Iterator<String> o = body.path("options").fieldNames(); o.hasNext(); ) {
                    String letter = o.next();
                    if (options == null || !options.has(letter)) problems.add(key + ": options." + letter + " không có trong đề");
                }
                if (body.has("options") && options != null) {
                    assertThat(body.path("options").size()).as(key + " options đủ").isEqualTo(options.size());
                }
            }
        }
        assertThat(problems).isEmpty();
        // test thật sự đi qua nội dung (không lặng lẽ bỏ qua vì sai khoá)
        assertThat(checked[0]).as("số evidence đã kiểm").isGreaterThanOrEqualTo(25);
        assertThat(checked[1]).as("số phương án sai đã kiểm").isGreaterThanOrEqualTo(35);
    }

    @Test
    void cau27De1KhongConGerne() throws IOException {
        String v360 = read("db/migration/V360__sua_de1_cau27_gern.sql");
        assertThat(v360).contains("{\"a\": \"gern\", \"b\": \"am liebsten\", \"c\": \"lieber\"}");
        // chuỗi cũ phải khớp đúng V328 thì replace mới có tác dụng
        String v328 = read("db/migration/V328__mock_exam_telc_b1_lesen_sprachbausteine.sql");
        assertThat(v328).contains("„Ich bringe sie gern mit“; „lieber“ nghĩa là thích hơn — không có so sánh ở đây.");
        assertThat(v328).contains("\"options\": { \"a\": \"gern\", \"b\": \"gerne\", \"c\": \"lieber\" }, \"correct\": \"a\"");
    }

    private static String teilText(JsonNode teil) {
        StringBuilder sb = new StringBuilder();
        teil.path("items").forEach(it -> sb.append(it.path("text").asText("")).append('\n'));
        sb.append(teil.path("context").asText("")).append('\n');
        teil.path("ads").forEach(a -> sb.append(a.asText()).append('\n'));
        sb.append(teil.path("gapped_text").asText(""));
        return sb.toString();
    }

    private static String firstBlock(String sql) {
        Matcher m = BLOCK.matcher(sql);
        if (!m.find()) throw new IllegalStateException("không thấy JSON đề");
        return m.group(1);
    }

    private static String read(String path) throws IOException {
        try (InputStream in = PracticeExplanationsDe4Test.class.getClassLoader().getResourceAsStream(path)) {
            if (in == null) throw new IOException("không thấy " + path);
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
