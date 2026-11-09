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
 * Bằng chứng ({@code evidence}) của MỌI đề telc B1 tìm được trong đúng khối chữ của câu (09/11/2026,
 * đánh dấu bài đọc đợt 1). Giao diện đổi câu trích → vị trí bằng {@code evidenceRanges.ts}: khoảng
 * trắng liền nhau (kể cả xuống dòng tác giả ngắt) coi như một dấu cách — test dùng đúng luật đó.
 * Câu trích không tìm thấy thì sau khi kiểm tra học viên không được tô chỗ đáp án, và màn chữa bài
 * không chẩn đoán được — nên đề mới thiếu / lệch câu trích phải làm test đỏ.
 *
 * <p>Không cần DB: đọc thẳng migration. Đề 1 lấy phần Đọc từ V328 (ghi đè V325), Đề 2–4 từ V343–V345;
 * giải thích Đề 1–3 ở V358, Đề 4 ở V361 (tìm đề theo tiêu đề "Đề số N").
 */
class PracticeEvidenceAllSetsTest {

    private static final ObjectMapper OM = new ObjectMapper();
    private static final Pattern BLOCK = Pattern.compile("\\$j\\$\\s*(\\{.*?})\\s*\\$j\\$", Pattern.DOTALL);
    private static final Pattern TEIL_KEY = Pattern.compile("SELECT id, '([A-Z]+-\\d)'");
    private static final Pattern SET = Pattern.compile("title = 'telc Deutsch B1 — Đề số (\\d)'");
    private static final Pattern SPACE = Pattern.compile("[\\s\\u00A0]+");

    /** Đề số → phần LESEN (JSON section). */
    private static final Map<Integer, JsonNode> lesen = new HashMap<>();
    /** "N/TEIL" → thân giải thích. */
    private static final Map<String, JsonNode> notes = new HashMap<>();

    @BeforeAll
    static void load() throws IOException {
        lesen.put(1, OM.readTree(firstBlock(read("V328__mock_exam_telc_b1_lesen_sprachbausteine.sql"))));
        lesen.put(2, section(OM.readTree(firstBlock(read("V343__mock_exam_telc_b1_set2_nhap.sql"))), "LESEN"));
        lesen.put(3, section(OM.readTree(firstBlock(read("V344__mock_exam_telc_b1_set3_nhap.sql"))), "LESEN"));
        lesen.put(4, section(OM.readTree(firstBlock(read("V345__mock_exam_telc_b1_set4_nhap.sql"))), "LESEN"));
        for (String file : List.of("V358__giai_thich_luyen_de_telc_b1.sql", "V361__giai_thich_luyen_de_telc_b1_de4.sql")) {
            for (String stmt : read(file).split("ON CONFLICT")) {
                Matcher k = TEIL_KEY.matcher(stmt);
                Matcher b = BLOCK.matcher(stmt);
                Matcher s = SET.matcher(stmt);
                if (k.find() && b.find() && s.find()) notes.put(s.group(1) + "/" + k.group(1), OM.readTree(b.group(1)));
            }
        }
    }

    @Test
    void duBonDeVaGiaiThichPhanDoc() {
        for (int n = 1; n <= 4; n++) {
            assertThat(lesen.get(n).path("name").asText()).as("Đề %d", n).isEqualTo("LESEN");
            for (String teil : List.of("LESEN-1", "LESEN-2", "LESEN-3")) {
                assertThat(notes).as("giải thích Đề %d %s", n, teil).containsKey(n + "/" + teil);
            }
        }
    }

    /** Lesen 2 (đợt 1): mọi câu có bằng chứng, và bằng chứng nằm trong bài đọc ({@code context}). */
    @Test
    void lesen2BangChungNamTrongBaiDoc() {
        List<String> problems = new ArrayList<>();
        int checked = 0;
        for (int n = 1; n <= 4; n++) {
            JsonNode teil = teil(lesen.get(n), 2);
            String ctx = teil.path("context").asText();
            assertThat(ctx).as("Đề %d có bài đọc", n).isNotBlank();
            JsonNode items = notes.get(n + "/LESEN-2").path("items");
            for (JsonNode item : teil.path("items")) {
                String id = item.path("id").asText();
                JsonNode ev = items.path(id).path("evidence");
                if (!ev.isArray() || ev.isEmpty()) { problems.add("Đề " + n + " " + id + ": thiếu evidence"); continue; }
                for (JsonNode quote : ev) {
                    checked++;
                    if (!found(ctx, quote.asText())) problems.add("Đề " + n + " " + id + ": không thấy „" + quote.asText() + "“");
                }
            }
        }
        assertThat(problems).isEmpty();
        assertThat(checked).as("số câu trích đã kiểm").isGreaterThanOrEqualTo(20);
    }

    /** Lesen 1 (đợt 3): bằng chứng nằm trong chính đoạn văn của câu. Lesen 3: trong rao vặt hoặc tình huống. */
    @Test
    void lesen1Va3BangChungNamTrongKhoiCuaCau() {
        List<String> problems = new ArrayList<>();
        for (int n = 1; n <= 4; n++) {
            JsonNode t1 = teil(lesen.get(n), 1);
            JsonNode notes1 = notes.get(n + "/LESEN-1").path("items");
            for (JsonNode item : t1.path("items")) {
                String id = item.path("id").asText();
                for (JsonNode quote : notes1.path(id).path("evidence")) {
                    if (!found(item.path("text").asText(), quote.asText())) problems.add("Đề " + n + " " + id + ": „" + quote.asText() + "“");
                }
            }
            JsonNode t3 = teil(lesen.get(n), 3);
            StringBuilder pool = new StringBuilder();
            t3.path("ads").forEach(a -> pool.append(a.isTextual() ? a.asText() : a.toString()).append('\n'));
            t3.path("items").forEach(it -> pool.append(it.path("situation").asText()).append(' ')
                    .append(it.path("question").asText()).append(' ').append(it.path("text").asText()).append('\n'));
            JsonNode notes3 = notes.get(n + "/LESEN-3").path("items");
            for (Iterator<Map.Entry<String, JsonNode>> it = notes3.fields(); it.hasNext(); ) {
                var e = it.next();
                for (JsonNode quote : e.getValue().path("evidence")) {
                    if (!found(pool.toString(), quote.asText())) problems.add("Đề " + n + " " + e.getKey() + ": „" + quote.asText() + "“");
                }
            }
        }
        assertThat(problems).isEmpty();
    }

    /** Cùng luật với {@code evidenceRanges.ts}: so trên chuỗi đã gộp khoảng trắng. */
    static boolean found(String block, String quote) {
        String q = SPACE.matcher(quote).replaceAll(" ").strip();
        return !q.isEmpty() && SPACE.matcher(block).replaceAll(" ").contains(q);
    }

    private static JsonNode teil(JsonNode section, int number) {
        for (JsonNode t : section.path("teile")) if (t.path("teil").asInt() == number) return t;
        throw new IllegalStateException("không thấy Teil " + number);
    }

    private static JsonNode section(JsonNode exam, String name) {
        for (JsonNode s : exam.path("sections")) if (name.equals(s.path("name").asText())) return s;
        throw new IllegalStateException("không thấy phần " + name);
    }

    private static String firstBlock(String sql) {
        Matcher m = BLOCK.matcher(sql);
        if (!m.find()) throw new IllegalStateException("không thấy JSON đề");
        return m.group(1);
    }

    private static String read(String file) throws IOException {
        try (InputStream in = PracticeEvidenceAllSetsTest.class.getClassLoader().getResourceAsStream("db/migration/" + file)) {
            if (in == null) throw new IOException("không thấy " + file);
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
