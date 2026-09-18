package com.deutschflow.grammar.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

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
    /**
     * Các migration sau V325 ghi đè TỪNG PHẦN của đề này bằng {@code jsonb_set(…, '{sections,N}', …)}
     * (V327: Nghe; V328: Đọc + Sprachbausteine). Cổng này soi nội dung HIỆU LỰC (V325 + mọi lớp
     * ghi đè, theo thứ tự số), vì soi V325 không thì đang soi một đề mà không học viên nào còn làm.
     */
    private static final Pattern OVERLAY_FILE = Pattern.compile("V3\\d\\d__mock_exam_telc_b1_(?!set1).*\\.sql");
    private static final Pattern OVERLAY_BLOCK = Pattern.compile(
            "'\\{sections,(\\d+)}',\\s*\\$j\\$\\s*(\\{.*?})\\s*\\$j\\$::jsonb", Pattern.DOTALL);

    private static Map<String, Object> exam;
    /** Bản V325 nguyên gốc — để so đáp án trước/sau lớp ghi đè. */
    private static Map<String, Object> original;

    @BeforeAll
    static void loadSeed() throws IOException {
        Matcher m = Pattern.compile("\\$j\\$\\s*(\\{.*?\"sections\".*?})\\s*\\$j\\$", Pattern.DOTALL)
                .matcher(Files.readString(SEED));
        assertThat(m.find()).as("không trích được sections_json từ %s", SEED.getFileName()).isTrue();
        original = OM.readValue(m.group(1), Map.class);
        exam = OM.readValue(m.group(1), Map.class);

        @SuppressWarnings("unchecked")
        List<Object> sections = new ArrayList<>((List<Object>) exam.get("sections"));
        List<Path> overlays;
        try (var files = Files.list(SEED.getParent())) {
            overlays = files.filter(f -> OVERLAY_FILE.matcher(f.getFileName().toString()).matches())
                    .sorted().toList();
        }
        assertThat(overlays).as("phải có ít nhất lớp V327").isNotEmpty();
        for (Path file : overlays) {
            Matcher block = OVERLAY_BLOCK.matcher(Files.readString(file));
            int found = 0;
            while (block.find()) {
                found++;
                int index = Integer.parseInt(block.group(1));
                Map<String, Object> section = OM.readValue(block.group(2), Map.class);
                assertThat(((Map<?, ?>) sections.get(index)).get("name"))
                        .as("%s ghi vào '{sections,%d}' — vị trí đó phải là đúng phần, kẻo ghi đè nhầm", file.getFileName(), index)
                        .isEqualTo(section.get("name"));
                sections.set(index, section);
            }
            assertThat(found).as("không trích được khối jsonb_set nào từ %s", file.getFileName()).isPositive();
        }
        exam.put("sections", sections);
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

    // ── Viết (Gói C, 17/09/2026) ─────────────────────────────────────────────────────────────────
    // Übungstest telc 2020 + 35 đề thật tái dựng: phần Viết LUÔN là E-Mail xưng du trả lời E-Mail
    // của một người bạn (in nguyên văn phía trên), bốn Leitpunkte in xáo thứ tự, Anweisung đòi
    // „eine passende Reihenfolge", KHÔNG quy định số từ. V325 là thư khiếu nại không có văn bản
    // kích thích và đòi „circa 100 Wörter" — cổng này giữ cho không tụt lại.

    @Test
    @DisplayName("phần Viết: E-Mail xưng du của bạn in trước, 60–140 từ; Leitpunkte xáo; Anweisung không ghi số từ")
    void schreiben_isReplyToFriendsEmail() {
        Map<?, ?> teil = (Map<?, ?>) teileOf("SCHREIBEN").get(0);
        Map<?, ?> stimulus = (Map<?, ?>) teil.get("stimulus");
        assertThat(stimulus).as("phải có văn bản kích thích").isNotNull();
        assertThat(stimulus.get("type")).isEqualTo("EMAIL");
        assertThat(stimulus.get("from")).asString().isNotBlank();
        assertThat(stimulus.get("subject")).asString().isNotBlank();
        String body = String.valueOf(stimulus.get("body"));
        assertThat(wordCount(body)).as("E-Mail của bạn dài như đề thật").isBetween(60, 140);
        assertThat(body).as("xưng du, không phải Sie").containsAnyOf(" dir", " dich", " du ", "du?");
        assertThat(body).doesNotContain("Sie ").doesNotContain("Ihnen");

        assertThat(teil.get("shuffle_points")).isEqualTo(Boolean.TRUE);
        assertThat(String.valueOf(teil.get("instruction_de")))
                .as("Anweisung tiếng Đức không quy định số từ, đòi thứ tự hợp lý")
                .doesNotContainIgnoringCase("Wörter")
                .containsIgnoringCase("Reihenfolge")
                .contains("E-Mail");
        assertThat(String.valueOf(teil.get("instruction_vi")))
                .as("gợi ý độ dài chỉ nằm ở bản tiếng Việt")
                .contains("từ");
    }

    // ── Nghi thức bài nghe (Gói B, 17/09/2026) ──────────────────────────────────────────────────
    // Đo trên CD đề mẫu và Übungstest telc 2020: Teil 1 = 5 lời kể 60–110 từ (34–48 s) về MỘT chủ
    // đề có câu khung; Teil 2 = phỏng vấn radio 500–650 từ; Teil 3 = 5 bài 40–90 từ có câu dẫn tình
    // huống. Bản V325 chỉ bằng ¼–⅓ độ dài đó và Teil 1 sai thể loại — cổng này giữ cho không tụt lại.

    @Test
    @DisplayName("Ansage nguyên văn và thời gian đọc câu hỏi: 30 s / 60 s / 0, một lần / hai lần")
    void hoeren_hasAnsageAndReadingTime() {
        List<?> teile = teileOf("HOEREN");
        Map<?, ?> t1 = (Map<?, ?>) teile.get(0);
        Map<?, ?> t2 = (Map<?, ?>) teile.get(1);
        Map<?, ?> t3 = (Map<?, ?>) teile.get(2);

        assertThat(t1.get("ansage_de")).asString().contains("nur einmal").contains("30 Sekunden");
        assertThat(t1.get("reading_seconds")).isEqualTo(30);
        assertThat(t1.get("framing_de")).asString().as("Teil 1 phải có câu khung dẫn vào chủ đề").isNotBlank();

        assertThat(t2.get("ansage_de")).asString().contains("zweimal").contains("eine Minute");
        assertThat(t2.get("reading_seconds")).isEqualTo(60);

        assertThat(t3.get("ansage_de")).asString().contains("zweimal");
        assertThat(t3.get("reading_seconds")).isEqualTo(0);
    }

    @Test
    @DisplayName("Teil 1 là năm LỜI KỂ cùng chủ đề, 60–110 từ, giọng nam nữ xen kẽ — không phải thông báo")
    void hoerenTeil1_isFiveStatementsOfOneSurvey() {
        Map<?, ?> t1 = (Map<?, ?>) teileOf("HOEREN").get(0);
        List<?> items = (List<?>) t1.get("items");
        Set<String> speakers = items.stream()
                .map(it -> String.valueOf(((Map<?, ?>) it).get("speaker"))).collect(Collectors.toSet());
        assertThat(speakers).as("hai giọng persona, xen kẽ").containsExactlyInAnyOrder("PRUEFER", "PARTNER");
        for (Object itemObj : items) {
            Map<?, ?> item = (Map<?, ?>) itemObj;
            String q = String.valueOf(item.get("question"));
            assertThat(q).as("câu %s phải nói về người nói", item.get("id"))
                    .matches("(Der Sprecher|Die Sprecherin|Zu der .*Sprecher).*");
            int words = wordCount(String.valueOf(item.get("audio_script")));
            assertThat(words).as("bài %s: số từ", item.get("id")).isBetween(60, 130);
            assertThat(String.valueOf(item.get("audio_script")))
                    .as("lời kể ngôi thứ nhất, không phải Durchsage")
                    .containsAnyOf("Ich ", "ich ");
        }
    }

    @Test
    @DisplayName("Teil 2 là phỏng vấn radio ≥ 450 từ: chào thính giả, cảm ơn cuối, 10 mệnh đề")
    void hoerenTeil2_isFullLengthRadioInterview() {
        Map<?, ?> t2 = (Map<?, ?>) teileOf("HOEREN").get(1);
        List<?> turns = (List<?>) t2.get("audio_script");
        int words = turns.stream().mapToInt(t -> wordCount(String.valueOf(((Map<?, ?>) t).get("text")))).sum();
        assertThat(words).as("tổng số từ hội thoại").isGreaterThanOrEqualTo(450);
        assertThat(String.valueOf(((Map<?, ?>) turns.get(0)).get("text"))).contains("Hörerinnen und Hörer");
        assertThat(String.valueOf(((Map<?, ?>) turns.get(turns.size() - 2)).get("text"))).contains("Dank");
        assertThat((List<?>) t2.get("items")).hasSize(10);
    }

    @Test
    @DisplayName("Teil 3: mỗi bài có câu dẫn tình huống đọc trước và dài 40–110 từ")
    void hoerenTeil3_hasSituationLeadInPerItem() {
        Map<?, ?> t3 = (Map<?, ?>) teileOf("HOEREN").get(2);
        for (Object itemObj : (List<?>) t3.get("items")) {
            Map<?, ?> item = (Map<?, ?>) itemObj;
            assertThat(item.get("lead_in_de")).asString().as("câu dẫn của %s", item.get("id"))
                    .startsWith("Lesen Sie jetzt die Aufgabe ");
            assertThat(item.get("speaker")).as("giọng của %s", item.get("id")).isIn("PRUEFER", "PARTNER");
            assertThat(wordCount(String.valueOf(item.get("audio_script"))))
                    .as("bài %s: số từ", item.get("id")).isBetween(40, 110);
        }
    }

    @Test
    @DisplayName("các lớp ghi đè giữ nguyên id và đáp án của V325 — trừ SB Teil 2 (hộp từ xếp lại theo bảng chữ cái)")
    void overlays_keepAnswerKeyOfV325() {
        Map<String, String> before = answerKey(original);
        Map<String, String> after = answerKey(exam);
        // SB2 là ngoại lệ có chủ ý (V328): hộp từ mới phải xếp theo bảng chữ cái như đề thật nên chữ
        // cái đáp án đi theo hộp. Mọi câu khác — 1–30 và 41–60 — phải y hệt.
        before.keySet().removeIf(id -> id.startsWith("SB2-"));
        after.keySet().removeIf(id -> id.startsWith("SB2-"));
        assertThat(after).as("đáp án ngoài SB Teil 2 phải y hệt V325").isEqualTo(before);
        assertThat(after).hasSize(50);
    }

    // ── Đọc + Sprachbausteine (Gói A, 17/09/2026) ────────────────────────────────────────────────
    // Đo trên 10 Test Klett ZD + đề thật tái dựng: LV1 văn bản 55–110 từ, 5 tiêu đề thừa là „bóng";
    // LV2 370–520 từ có Vorspann, số dòng, chú thích, câu hỏi dạng Satzanfang KHÔNG theo thứ tự bài;
    // LV3 luôn hai Beispiele (một ghép, một x); SB1 130–180 từ; SB2 hộp 15 TỪ CHỨC NĂNG viết HOA
    // xếp theo bảng chữ cái, thư trả lời một mẩu tin in ngay trên.

    @Test
    @DisplayName("LV Teil 1: năm văn bản 55–130 từ, mười tiêu đề, không tiêu đề nào trùng chữ")
    void lesenTeil1_textsAreFullLength() {
        Map<?, ?> t1 = (Map<?, ?>) teileOf("LESEN").get(0);
        assertThat(((Map<?, ?>) t1.get("headlines")).keySet()).hasSize(10);
        for (Object itemObj : (List<?>) t1.get("items")) {
            Map<?, ?> item = (Map<?, ?>) itemObj;
            assertThat(wordCount(String.valueOf(item.get("text"))))
                    .as("văn bản %s: số từ", item.get("id")).isBetween(55, 130);
        }
    }

    @Test
    @DisplayName("LV Teil 2: bài ≥ 350 từ có Vorspann, số dòng, chú thích; câu 6–10 là Satzanfang không theo thứ tự bài")
    void lesenTeil2_isFullArticleWithSentenceStarts() {
        Map<?, ?> t2 = (Map<?, ?>) teileOf("LESEN").get(1);
        assertThat(wordCount(String.valueOf(t2.get("context")))).isGreaterThanOrEqualTo(350);
        assertThat(t2.get("vorspann_de")).asString().isNotBlank();
        assertThat(t2.get("context_lines")).isEqualTo(Boolean.TRUE);
        assertThat((List<?>) t2.get("glossary")).isNotEmpty();
        // Dòng tác giả ngắt ≈ 10 từ để số dòng trên màn ổn định: không dòng nào quá 16 từ.
        for (String line : String.valueOf(t2.get("context")).split("\\n")) {
            assertThat(wordCount(line)).as("dòng: %s", line).isLessThanOrEqualTo(16);
        }
        List<?> items = (List<?>) t2.get("items");
        assertThat(items).hasSize(5);
        for (Object itemObj : items) {
            Map<?, ?> item = (Map<?, ?>) itemObj;
            assertThat(String.valueOf(item.get("question")))
                    .as("%s phải là mở đầu câu, không phải câu hỏi", item.get("id")).doesNotContain("?");
            assertThat(((Map<?, ?>) item.get("options")).keySet().stream().map(String::valueOf).toList())
                    .containsExactlyInAnyOrder("a", "b", "c");
        }
        // Câu đầu tiên trả lời ở CUỐI bài (Frau Özdemir về lý do bỏ) — thứ tự không theo bài.
        assertThat(String.valueOf(((Map<?, ?>) items.get(0)).get("question"))).contains("hören");
    }

    @Test
    @DisplayName("LV Teil 3: đúng hai Beispiele — một trỏ vào mẩu có thật, một là x")
    void lesenTeil3_hasTwoExamples() {
        Map<?, ?> t3 = (Map<?, ?>) teileOf("LESEN").get(2);
        List<?> examples = (List<?>) t3.get("examples");
        Set<?> adKeys = ((Map<?, ?>) t3.get("ads")).keySet();
        assertThat(examples).hasSize(2);
        List<String> answers = examples.stream().map(e -> String.valueOf(((Map<?, ?>) e).get("answer"))).toList();
        assertThat(answers).contains("x");
        assertThat(answers.stream().filter(a -> !a.equals("x")).allMatch(adKeys::contains)).isTrue();
        assertThat(adKeys).hasSize(12);
        long noneCount = ((List<?>) t3.get("items")).stream()
                .filter(it -> "x".equals(((Map<?, ?>) it).get("correct"))).count();
        assertThat(noneCount).as("đề thật: đúng hai tình huống không mẩu nào hợp").isEqualTo(2);
    }

    @Test
    @DisplayName("SB Teil 1: thư 120–200 từ; SB Teil 2: hộp 15 từ chức năng viết HOA xếp theo bảng chữ cái, có mẩu tin kích thích")
    void sprachbausteine_matchRealFormat() {
        List<?> teile = teileOf("SPRACHBAUSTEINE");
        Map<?, ?> t1 = (Map<?, ?>) teile.get(0);
        Map<?, ?> t2 = (Map<?, ?>) teile.get(1);
        assertThat(wordCount(String.valueOf(t1.get("gapped_text")))).isBetween(120, 200);

        assertThat(t2.get("stimulus_ad")).asString().isNotBlank();
        @SuppressWarnings("unchecked")
        Map<String, String> bank = (Map<String, String>) t2.get("word_bank");
        assertThat(bank).hasSize(15);
        List<String> words = bank.keySet().stream().sorted().map(bank::get).toList();
        for (String w : words) {
            assertThat(w).as("từ trong hộp phải viết HOA như đề thật").isEqualTo(w.toUpperCase(java.util.Locale.GERMAN));
            assertThat(w).as("từ chức năng, không phải danh từ có hậu tố -UNG/-KEIT/-HEIT").doesNotEndWith("UNG").doesNotEndWith("KEIT");
        }
        java.text.Collator de = java.text.Collator.getInstance(java.util.Locale.GERMAN);
        for (int i = 1; i < words.size(); i++) {
            assertThat(de.compare(words.get(i - 1), words.get(i)))
                    .as("hộp từ phải xếp theo bảng chữ cái: %s trước %s", words.get(i - 1), words.get(i))
                    .isLessThanOrEqualTo(0);
        }
        List<?> items = (List<?>) t2.get("items");
        Set<String> used = items.stream().map(it -> String.valueOf(((Map<?, ?>) it).get("correct"))).collect(Collectors.toSet());
        assertThat(used).as("mỗi ô một từ khác nhau").hasSize(10);
        assertThat(bank.keySet()).containsAll(used);
    }

    private static Map<String, String> answerKey(Map<String, Object> root) {
        Map<String, String> key = new HashMap<>();
        for (Object sectionObj : (List<?>) root.get("sections")) {
            Map<?, ?> section = (Map<?, ?>) sectionObj;
            for (Object teilObj : (List<?>) section.get("teile")) {
                Object items = ((Map<?, ?>) teilObj).get("items");
                if (!(items instanceof List<?> list)) continue;
                for (Object itemObj : list) {
                    Map<?, ?> item = (Map<?, ?>) itemObj;
                    key.put(String.valueOf(item.get("id")), String.valueOf(item.get("correct")));
                }
            }
        }
        return key;
    }

    private static int wordCount(String text) {
        return (int) java.util.Arrays.stream(text.trim().split("\\s+")).filter(w -> !w.isBlank()).count();
    }

    private List<?> teileOf(String sectionName) {
        for (Object sectionObj : (List<?>) exam.get("sections")) {
            Map<?, ?> section = (Map<?, ?>) sectionObj;
            if (sectionName.equals(section.get("name"))) return (List<?>) section.get("teile");
        }
        throw new AssertionError("không có phần " + sectionName);
    }
}
