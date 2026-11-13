package com.deutschflow.examstudio;

import com.deutschflow.examstudio.ExamStudioDtos.AudioTurn;
import com.deutschflow.examstudio.ExamStudioDtos.Check;
import com.deutschflow.examstudio.ExamStudioDtos.Item;
import com.deutschflow.examstudio.ExamStudioDtos.Text;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Phần Nghe telc B1 của Xưởng đề — phần thuần: khuôn Teil, đọc câu trả lời của AI thành lời thoại, cân đáp án,
 * các đèn tự kiểm, và trên hết là khuôn xuất vào kho phải ĐÚNG khuôn phần HOEREN của đề viết tay (V343).
 */
@DisplayName("Xưởng đề đợt 5 — phần Nghe telc B1")
class HoerenTeileTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final SituationalTeile situ = new SituationalTeile(null);

    static final TeilSpec T1 = TeilSpec.find("TELC", "B1", "HOEREN", 1).orElseThrow();
    static final TeilSpec T2 = TeilSpec.find("TELC", "B1", "HOEREN", 2).orElseThrow();
    static final TeilSpec T3 = TeilSpec.find("TELC", "B1", "HOEREN", 3).orElseThrow();

    /** Các khoá đề viết tay có ở từng câu, cộng ba khoá riêng của Xưởng đề (bộ lọc đề của học viên bỏ ba khoá này). */
    static final List<String> STUDIO_ITEM_KEYS = List.of("evidence", "difficulty_target", "difficulty_measured");

    private static Item tf(String id, String question, String correct, String evidence) {
        return new Item(id, question, Map.of("richtig", "richtig", "falsch", "falsch"), correct, "vi ⇒ " + correct, evidence,
                List.of(), "MEDIUM", null, false, null, List.of());
    }

    private static String words(int n, String seed) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < n; i++) sb.append(seed).append(i).append(i == n - 1 ? "." : " ");
        return sb.toString();
    }

    private static Text segments(TeilSpec spec, boolean leadIns) {
        List<AudioTurn> turns = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            turns.add(new AudioTurn(i % 2 == 0 ? "PRUEFER" : "PARTNER", null, "Satz eins von Person " + i + ". " + words(70, "w" + i),
                    leadIns ? "Sie hören eine Durchsage Nummer " + i + "." : null));
        }
        String framing = leadIns ? null : "Was machen die Menschen mittags? Wir haben fünf Personen gefragt: „Wie verbringen Sie "
                + "Ihre Mittagspause?“ Hören Sie dazu die Antworten.";
        return new Text("", "", HoerenTeile.contextOf(turns), List.of(), null, null, null, null, null, null, turns, framing);
    }

    private static List<Item> segmentItems(TeilSpec spec, String... answers) {
        List<Item> items = new ArrayList<>();
        for (int i = 0; i < answers.length; i++) {
            items.add(tf(spec.itemId(i), "Die Person " + i + " macht etwas ganz anderes.", answers[i], "Satz eins von Person " + i + "."));
        }
        return items;
    }

    private static Text interview() {
        List<AudioTurn> turns = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            turns.add(new AudioTurn("PRUEFER", "Moderatorin", "Frage Nummer " + i + " an den Gast?", null));
            turns.add(new AudioTurn("PARTNER", "Herr Vogel", "Antwort Nummer " + i + " ist hier. " + words(45, "a" + i), null));
        }
        return new Text("Neu in der Nachbarschaft", "", HoerenTeile.contextOf(turns), List.of(), null, null, null, null, null,
                null, turns, null);
    }

    private static List<Item> interviewItems() {
        List<Item> items = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            items.add(tf(T2.itemId(i), "Herr Vogel sagt etwas zum Punkt " + i + ".", i % 2 == 0 ? "richtig" : "falsch",
                    "Antwort Nummer " + (i / 2) + " ist hier."));
        }
        return items;
    }

    @Nested
    @DisplayName("Khuôn Teil")
    class Specs {
        @Test
        @DisplayName("telc B1 có 9 Teil theo thứ tự trong đề; ba Teil Nghe soạn theo tình huống, đáp án richtig/falsch")
        void nineTeile() {
            List<TeilSpec> all = TeilSpec.forExam("telc", "b1");
            assertThat(all).extracting(s -> s.section() + "#" + s.teil()).containsExactly("LESEN#1", "LESEN#2", "LESEN#3",
                    "SPRACHBAUSTEINE#1", "SPRACHBAUSTEINE#2", "HOEREN#1", "HOEREN#2", "HOEREN#3", "SCHREIBEN#1");
            assertThat(TeilSpec.forExam("TELC", "A2")).noneMatch(TeilSpec::listening);
            for (TeilSpec s : List.of(T1, T2, T3)) {
                assertThat(s.listening()).isTrue();
                assertThat(s.situational()).isTrue();
                assertThat(s.writing()).isFalse();
                assertThat(s.headlines()).isFalse();
                assertThat(s.answerLetters()).containsExactly("richtig", "falsch");
                assertThat(ExamSetRunService.sourcesNeeded(s)).isZero();
            }
            assertThat(TeilSpec.find("TELC", "B1", "LESEN", 2).orElseThrow().listening()).isFalse();
        }

        @Test
        @DisplayName("mã câu, điểm, số lần nghe, giây đọc đề đúng luật telc B1")
        void numbers() {
            assertThat(List.of(T1.teilType(), T2.teilType(), T3.teilType()))
                    .containsExactly("HOEREN_STATEMENTS", "HOEREN_INTERVIEW", "HOEREN_ANNOUNCEMENTS");
            assertThat(List.of(T1.itemId(0), T1.itemId(4), T2.itemId(0), T2.itemId(9), T3.itemId(0), T3.itemId(4)))
                    .containsExactly("HV1-41", "HV1-45", "HV2-46", "HV2-55", "HV3-56", "HV3-60");
            assertThat(List.of(T1.itemCount(), T2.itemCount(), T3.itemCount())).containsExactly(5, 10, 5);
            assertThat(T1.points()).isEqualTo(5);
            assertThat(T2.points()).isEqualTo(2.5);
            assertThat(T3.points()).isEqualTo(5);
            assertThat(List.of(T1.maxPlays(), T2.maxPlays(), T3.maxPlays())).containsExactly(1, 2, 2);
            assertThat(List.of(T1.readingSeconds(), T2.readingSeconds(), T3.readingSeconds())).containsExactly(30, 60, 0);
            assertThat(List.of(T1.listeningSegments(), T2.listeningSegments(), T3.listeningSegments()))
                    .containsExactly(true, false, true);
        }

        @Test
        @DisplayName("lời dẫn và chỉ dẫn nguyên văn như đề viết tay (V343)")
        void officialWording() {
            assertThat(T1.ansageDe()).isEqualTo("Hörverstehen, Teil 1. Sie hören nun fünf kurze Texte. Dazu sollen Sie fünf "
                    + "Aufgaben lösen. Sie hören diese Texte nur einmal. Entscheiden Sie beim Hören, ob die Aussagen 41 bis 45 "
                    + "richtig oder falsch sind. Lesen Sie jetzt die Aufgaben 41 bis 45. Sie haben dazu 30 Sekunden Zeit.");
            assertThat(T2.ansageDe()).isEqualTo("Hörverstehen, Teil 2. Sie hören nun ein Gespräch. Dazu sollen Sie zehn Aufgaben "
                    + "lösen. Sie hören das Gespräch zweimal. Entscheiden Sie beim Hören, ob die Aussagen 46 bis 55 richtig oder "
                    + "falsch sind. Lesen Sie jetzt die Aufgaben 46 bis 55. Sie haben dazu eine Minute Zeit.");
            assertThat(T3.ansageDe()).isEqualTo("Hörverstehen, Teil 3. Sie hören nun fünf kurze Texte. Dazu sollen Sie fünf "
                    + "Aufgaben lösen. Sie hören jeden Text zweimal. Entscheiden Sie beim Hören, ob die Aussagen 56 bis 60 "
                    + "richtig oder falsch sind.");
            assertThat(T1.instructionDe()).isEqualTo("Sie hören nun fünf kurze Texte. Sie hören diese Texte nur einmal. "
                    + "Entscheiden Sie beim Hören, ob die Aussagen 41–45 richtig oder falsch sind.");
            assertThat(T2.instructionDe()).isEqualTo("Sie hören nun ein Gespräch. Sie hören das Gespräch zweimal. "
                    + "Entscheiden Sie beim Hören, ob die Aussagen 46–55 richtig oder falsch sind.");
            assertThat(T3.instructionDe()).isEqualTo("Sie hören nun fünf kurze Texte. Sie hören jeden Text zweimal. "
                    + "Entscheiden Sie beim Hören, ob die Aussagen 56–60 richtig oder falsch sind.");
            assertThat(TeilSpec.find("TELC", "B1", "LESEN", 2).orElseThrow().ansageDe()).isNull();
        }

        @Test
        @DisplayName("các prompt có tham số vẫn format được (không có dấu % lạc)")
        void promptsFormat() {
            String spoken = HoerenTeile.SPOKEN_RULES.formatted("B1");
            assertThat(spoken).contains("VORGELESEN").contains("Niveau\nB1").contains("Politik, Migration, Krieg, Religion");
            assertThat(HoerenTeile.STATEMENTS_SYSTEM.formatted("B1", 5, 60, 110, spoken)).contains("GENAU 5 verschiedene Personen")
                    .contains("je 60–110 Wörter").contains("GESPROCHENE SPRACHE").contains("\"statements\"");
            assertThat(HoerenTeile.INTERVIEW_SYSTEM.formatted("B1", 400, 650, spoken)).contains("400–650 Wörtern")
                    .contains("VERSCHIEDENE Geschlechter").contains("\"turns\"");
            assertThat(HoerenTeile.ANNOUNCEMENTS_SYSTEM.formatted("B1", 5, 40, 95, spoken)).contains("GENAU 5").contains("\"scene\"")
                    .contains("OHNE Aufgabennummer");
            for (String task : List.of(HoerenTeile.STATEMENTS_TASK, HoerenTeile.INTERVIEW_TASK, HoerenTeile.ANNOUNCEMENTS_TASK)) {
                assertThat(HoerenTeile.ITEMS_SYSTEM.formatted("B1", task, "B1", "B1")).contains("WIDERSPRICHT")
                        .contains("NICHT wörtlich").contains("NIEMALS eine Aussage, über die der Hörtext nichts sagt")
                        .contains("\"explanationVi\"").contains(task.substring(0, 20));
            }
        }
    }

    @Nested
    @DisplayName("Đọc câu trả lời của AI thành lời thoại")
    class Parsing {
        @Test
        @DisplayName("Teil 1: câu khung ghép đúng kiểu đề viết tay; giọng theo giới; bỏ 'Nummer 41.' model tự thêm")
        void statements() throws Exception {
            JsonNode out = mapper.readTree("""
                    {"topic": "Was machen die Menschen in ihrer Mittagspause?",
                     "question": "„Wie verbringen Sie Ihre Mittagspause, und warum so?“",
                     "statements": [{"gender": "f", "text": "Nummer 41. Ich arbeite in einer Versicherung."},
                       {"gender": "m", "text": "Ich bin **Handwerker**."}, {"gender": "weiblich", "text": "Ich nutze die Pause für Sport."},
                       {"text": "Ich bin Lehrer."}, {"gender": "f", "text": "Ich treffe meine Schwester."},
                       {"gender": "m", "text": "Sechster, zu viel."}]}
                    """);
            Text t = HoerenTeile.statementsText(T1, out);
            assertThat(t.framingDe()).isEqualTo("Was machen die Menschen in ihrer Mittagspause? Wir haben fünf Personen gefragt: "
                    + "„Wie verbringen Sie Ihre Mittagspause, und warum so?“ Hören Sie dazu die Antworten.");
            assertThat(t.audioTurns()).hasSize(5);
            assertThat(t.audioTurns()).extracting(AudioTurn::speaker)
                    .containsExactly("PRUEFER", "PARTNER", "PRUEFER", "PARTNER", "PRUEFER"); // thiếu giới ⇒ xen kẽ theo vị trí
            assertThat(t.audioTurns().get(0).text()).isEqualTo("Ich arbeite in einer Versicherung.");
            assertThat(t.audioTurns().get(1).text()).isEqualTo("Ich bin Handwerker.");
            assertThat(t.context()).isEqualTo(String.join("\n\n", t.audioTurns().stream().map(AudioTurn::text).toList()));
        }

        @Test
        @DisplayName("Teil 1 thiếu đoạn ⇒ báo lỗi để chạy lại, không lưu bài thiếu")
        void statementsTooFew() throws Exception {
            JsonNode out = mapper.readTree("{\"question\": \"Q?\", \"statements\": [{\"gender\": \"f\", \"text\": \"Eins.\"}]}");
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> HoerenTeile.statementsText(T1, out))
                    .isInstanceOf(IllegalStateException.class).hasMessageContaining("1/5");
        }

        @Test
        @DisplayName("Teil 2: người dẫn và khách luôn hai giọng khác nhau, có tên; Teil 3: câu dẫn không kèm số câu")
        void interviewAndAnnouncements() throws Exception {
            StringBuilder turns = new StringBuilder();
            for (int i = 0; i < 4; i++) {
                turns.append(i == 0 ? "" : ",").append("{\"role\": \"host\", \"text\": \"Frage ").append(i).append("?\"},")
                        .append("{\"role\": \"guest\", \"text\": \"Antwort ").append(i).append(".\"}");
            }
            JsonNode out = mapper.readTree("{\"show\": \"Stadtleben\", \"hostGender\": \"f\", \"guestName\": \"Herr Vogel\", "
                    + "\"guestGender\": \"f\", \"turns\": [" + turns + "]}");
            Text t = HoerenTeile.interviewText(out);
            assertThat(t.audioTurns()).hasSize(8);
            assertThat(t.audioTurns().get(0)).isEqualTo(new AudioTurn("PRUEFER", "Moderatorin", "Frage 0?", null));
            // Model khai khách cũng là nữ: vẫn cho giọng khác người dẫn để hai giọng TTS phân biệt được.
            assertThat(t.audioTurns().get(1)).isEqualTo(new AudioTurn("PARTNER", "Herr Vogel", "Antwort 0.", null));

            JsonNode ann = mapper.readTree("""
                    {"texts": [
                      {"gender": "f", "scene": "Lesen Sie jetzt die Aufgabe 56. Sie hören eine Nachricht auf Ihrem Anrufbeantworter.", "text": "Guten Tag."},
                      {"gender": "m", "scene": "Sie sind im Kaufhaus und hören folgende Durchsage.", "text": "Liebe Kunden."},
                      {"gender": "f", "scene": "Im Radio hören Sie den Wetterbericht.", "text": "Und nun das Wetter."},
                      {"gender": "m", "scene": "Sie hören eine Nachricht von einem Kollegen.", "text": "Hallo Anna."},
                      {"gender": "f", "scene": "Sie sind am Bahnhof und hören folgende Durchsage.", "text": "Achtung an Gleis drei."}]}
                    """);
            Text a = HoerenTeile.announcementsText(T3, ann);
            assertThat(a.audioTurns()).hasSize(5);
            assertThat(a.audioTurns().get(0).leadInDe()).isEqualTo("Sie hören eine Nachricht auf Ihrem Anrufbeantworter.");
            assertThat(a.audioTurns()).extracting(AudioTurn::speaker)
                    .containsExactly("PRUEFER", "PARTNER", "PRUEFER", "PARTNER", "PRUEFER");
            assertThat(a.framingDe()).isNull();
        }
    }

    @Nested
    @DisplayName("Khuôn xuất vào kho = khuôn phần HOEREN của đề viết tay")
    class Export {
        @Test
        @DisplayName("Teil 1: câu khung, nghe một lần, mỗi câu mang giọng + lời thoại bắt đầu bằng 'Nummer NN.'")
        @SuppressWarnings("unchecked")
        void teil1() throws Exception {
            Text t = segments(T1, false);
            Map<String, Object> c = situ.content(T1, t, segmentItems(T1, "falsch", "richtig", "richtig", "falsch", "falsch"));
            // Đúng bộ khoá cấp Teil của đề viết tay — không thừa (không có "type"), không thiếu.
            assertThat(c.keySet()).containsExactlyInAnyOrder("teil", "items", "ansage_de", "max_plays", "framing_de",
                    "instruction_de", "instruction_vi", "point_per_item", "reading_seconds");
            assertThat(c).containsEntry("teil", 1).containsEntry("point_per_item", 5).containsEntry("max_plays", 1)
                    .containsEntry("reading_seconds", 30).containsEntry("framing_de", t.framingDe())
                    .containsEntry("ansage_de", T1.ansageDe()).containsEntry("instruction_de", T1.instructionDe());
            List<Map<String, Object>> items = (List<Map<String, Object>>) c.get("items");
            assertThat(items).hasSize(5);
            List<String> handwritten = List.of("id", "speaker", "question", "audio_script", "correct", "explanation_vi");
            for (int i = 0; i < 5; i++) {
                Map<String, Object> it = items.get(i);
                List<String> expected = new ArrayList<>(handwritten);
                expected.addAll(STUDIO_ITEM_KEYS);
                assertThat(it.keySet()).containsExactlyInAnyOrderElementsOf(expected);
                assertThat(it).containsEntry("id", "HV1-" + (41 + i)).containsEntry("speaker", i % 2 == 0 ? "PRUEFER" : "PARTNER");
                assertThat((String) it.get("audio_script")).startsWith("Nummer " + (41 + i) + ". Satz eins von Person " + i + ".");
                assertThat(it.get("correct")).isIn("richtig", "falsch");
            }
            // Qua JSON thật (như lúc ghi content_json): số là số, lời thoại là chuỗi.
            JsonNode json = mapper.readTree(mapper.writeValueAsString(c));
            assertThat(json.path("max_plays").isInt()).isTrue();
            assertThat(json.path("items").get(0).path("audio_script").isTextual()).isTrue();
            assertThat(json.has("type")).isFalse();
            assertThat(json.has("audio_script")).isFalse();
        }

        @Test
        @DisplayName("Teil 2: lời thoại ở cấp Teil là mảng lượt lời {speaker, name, text}; câu chỉ có mệnh đề + đáp án")
        @SuppressWarnings("unchecked")
        void teil2() throws Exception {
            Text t = interview();
            Map<String, Object> c = situ.content(T2, t, interviewItems());
            assertThat(c.keySet()).containsExactlyInAnyOrder("teil", "items", "ansage_de", "max_plays", "audio_script",
                    "instruction_de", "instruction_vi", "point_per_item", "reading_seconds");
            assertThat(c).containsEntry("teil", 2).containsEntry("point_per_item", 2.5).containsEntry("max_plays", 2)
                    .containsEntry("reading_seconds", 60).containsEntry("ansage_de", T2.ansageDe());
            List<Map<String, Object>> script = (List<Map<String, Object>>) c.get("audio_script");
            assertThat(script).hasSize(10);
            assertThat(script).allSatisfy(turn -> assertThat(turn.keySet()).containsExactly("speaker", "name", "text"));
            assertThat(script.get(0)).containsEntry("speaker", "PRUEFER").containsEntry("name", "Moderatorin")
                    .containsEntry("text", "Frage Nummer 0 an den Gast?");
            assertThat(script.get(1)).containsEntry("speaker", "PARTNER").containsEntry("name", "Herr Vogel");
            List<Map<String, Object>> items = (List<Map<String, Object>>) c.get("items");
            assertThat(items).hasSize(10);
            List<String> expected = new ArrayList<>(List.of("id", "question", "correct", "explanation_vi"));
            expected.addAll(STUDIO_ITEM_KEYS);
            assertThat(items).allSatisfy(it -> assertThat(it.keySet()).containsExactlyInAnyOrderElementsOf(expected));
            assertThat(items).extracting(it -> it.get("id")).containsExactly("HV2-46", "HV2-47", "HV2-48", "HV2-49", "HV2-50",
                    "HV2-51", "HV2-52", "HV2-53", "HV2-54", "HV2-55");
            JsonNode json = mapper.readTree(mapper.writeValueAsString(c));
            assertThat(json.path("audio_script").isArray()).isTrue();
            assertThat(json.path("point_per_item").asDouble()).isEqualTo(2.5);
            assertThat(json.has("framing_de")).isFalse();
        }

        @Test
        @DisplayName("Teil 3: mỗi câu có câu dẫn 'Lesen Sie jetzt die Aufgabe NN. …' và lời thoại KHÔNG có 'Nummer NN.'")
        @SuppressWarnings("unchecked")
        void teil3() {
            Text t = segments(T3, true);
            Map<String, Object> c = situ.content(T3, t, segmentItems(T3, "richtig", "falsch", "richtig", "falsch", "richtig"));
            assertThat(c.keySet()).containsExactlyInAnyOrder("teil", "items", "ansage_de", "max_plays", "instruction_de",
                    "instruction_vi", "point_per_item", "reading_seconds");
            assertThat(c).containsEntry("teil", 3).containsEntry("point_per_item", 5).containsEntry("max_plays", 2)
                    .containsEntry("reading_seconds", 0);
            List<Map<String, Object>> items = (List<Map<String, Object>>) c.get("items");
            List<String> expected = new ArrayList<>(List.of("id", "speaker", "lead_in_de", "question", "audio_script", "correct",
                    "explanation_vi"));
            expected.addAll(STUDIO_ITEM_KEYS);
            for (int i = 0; i < 5; i++) {
                Map<String, Object> it = items.get(i);
                assertThat(it.keySet()).containsExactlyInAnyOrderElementsOf(expected);
                assertThat(it).containsEntry("id", "HV3-" + (56 + i)).containsEntry("lead_in_de",
                        "Lesen Sie jetzt die Aufgabe " + (56 + i) + ". Sie hören eine Durchsage Nummer " + i + ".");
                assertThat((String) it.get("audio_script")).startsWith("Satz eins von Person " + i + ".");
            }
        }

        @Test
        @DisplayName("lời thoại đi theo MÃ câu, không theo vị trí trong danh sách (thiếu một câu vẫn không lệch đoạn)")
        @SuppressWarnings("unchecked")
        void segmentFollowsItemId() {
            Text t = segments(T1, false);
            List<Item> items = new ArrayList<>(segmentItems(T1, "falsch", "richtig", "richtig", "falsch", "falsch"));
            items.remove(1); // mất câu HV1-42
            List<Map<String, Object>> out = (List<Map<String, Object>>) situ.content(T1, t, items).get("items");
            assertThat(out.get(1)).containsEntry("id", "HV1-43");
            assertThat((String) out.get(1).get("audio_script")).startsWith("Nummer 43. Satz eins von Person 2.");
            assertThat(HoerenTeile.slotOf(T1, items.get(1))).isEqualTo(2);
            assertThat(HoerenTeile.slotOf(T1, tf("LV2-6", "q", "richtig", ""))).isEqualTo(-1);
        }

        @Test
        @DisplayName("chống trùng: chữ của Teil Nghe gồm câu khung, lời thoại và mệnh đề; câu dẫn nghi thức không tính")
        void dedupText() {
            String t1 = ExamDedupService.contentText(situ.content(T1, segments(T1, false),
                    segmentItems(T1, "falsch", "richtig", "richtig", "falsch", "falsch")));
            assertThat(t1).contains("Wir haben fünf Personen gefragt").contains("Satz eins von Person 3.")
                    .contains("Die Person 4 macht etwas ganz anderes.");
            String t2 = ExamDedupService.contentText(situ.content(T2, interview(), interviewItems()));
            assertThat(t2).contains("Frage Nummer 0 an den Gast?").contains("Antwort Nummer 4 ist hier.")
                    .contains("Herr Vogel sagt etwas zum Punkt 9.");
            String t3 = ExamDedupService.contentText(situ.content(T3, segments(T3, true),
                    segmentItems(T3, "richtig", "falsch", "richtig", "falsch", "richtig")));
            assertThat(t3).contains("Satz eins von Person 0.").doesNotContain("Lesen Sie jetzt die Aufgabe");
        }
    }

    @Nested
    @DisplayName("Cân richtig/falsch")
    class Balance {
        @Test
        @DisplayName("đèn: 40–60 % mỗi loại là xanh; lệch là vàng; mọi câu cùng một đáp án là đỏ")
        void light() {
            assertThat(HoerenTeile.balanceLight(List.of("richtig", "falsch", "richtig", "falsch", "falsch"))).isEqualTo("GREEN");
            assertThat(HoerenTeile.balanceLight(List.of("richtig", "richtig", "richtig", "falsch", "falsch"))).isEqualTo("GREEN");
            assertThat(HoerenTeile.balanceLight(List.of("richtig", "richtig", "richtig", "richtig", "falsch"))).isEqualTo("YELLOW");
            assertThat(HoerenTeile.balanceLight(List.of("falsch", "falsch", "falsch", "falsch", "falsch"))).isEqualTo("RED");
            assertThat(HoerenTeile.balanceLight(List.of("richtig", "richtig", "richtig", "richtig", "richtig"))).isEqualTo("RED");
            assertThat(HoerenTeile.balanceLight(List.of())).isEqualTo("RED");
            List<String> ten = new ArrayList<>();
            for (int i = 0; i < 10; i++) ten.add(i < 6 ? "richtig" : "falsch");
            assertThat(HoerenTeile.balanceLight(ten)).isEqualTo("GREEN");
            ten.set(6, "richtig");
            assertThat(HoerenTeile.balanceLight(ten)).isEqualTo("YELLOW");
        }

        @Test
        @DisplayName("máy giao đáp án: sinh cả Teil thì một nửa richtig, không quá 3 câu liền cùng đáp án")
        void planFull() {
            for (long seed = 0; seed < 200; seed++) {
                List<String> five = HoerenTeile.planAnswers(Arrays.asList(null, null, null, null, null), new Random(seed));
                assertThat(five).hasSize(5).doesNotContainNull();
                assertThat(five.stream().filter("richtig"::equals).count()).isBetween(2L, 3L);
                assertThat(HoerenTeile.balanceLight(five)).isEqualTo("GREEN");
                List<String> ten = HoerenTeile.planAnswers(Arrays.asList(new String[10]), new Random(seed));
                assertThat(ten.stream().filter("richtig"::equals).count()).isEqualTo(5);
                assertThat(HoerenTeile.longestRun(ten)).isLessThanOrEqualTo(3);
            }
        }

        @Test
        @DisplayName("sinh lại riêng một câu: câu giữ nguyên không đổi, câu mới nhận đáp án đang thiếu")
        void planOne() {
            for (long seed = 0; seed < 50; seed++) {
                List<String> a = HoerenTeile.planAnswers(Arrays.asList("richtig", "richtig", null, "richtig", "falsch"), new Random(seed));
                assertThat(a).containsExactly("richtig", "richtig", "falsch", "richtig", "falsch");
                List<String> b = HoerenTeile.planAnswers(Arrays.asList("falsch", "falsch", "falsch", null, "falsch"), new Random(seed));
                assertThat(b.get(3)).isEqualTo("richtig");
                assertThat(b.subList(0, 3)).containsOnly("falsch");
            }
        }
    }

    @Nested
    @DisplayName("Tự kiểm")
    class Checks {
        private String light(List<Check> checks, String key) {
            return checks.stream().filter(c -> c.key().equals(key)).findFirst().orElseThrow().light();
        }

        @Test
        @DisplayName("Teil đủ khuôn: mọi đèn riêng của phần Nghe đều xanh")
        void green() {
            List<Check> c1 = situ.checks(T1, segments(T1, false), segmentItems(T1, "falsch", "richtig", "richtig", "falsch", "falsch"), null);
            assertThat(c1).extracting(Check::key).containsExactly("SCRIPT", "LENGTH", "VOICES", "ANSWERS", "PARAPHRASE");
            assertThat(c1).allSatisfy(c -> assertThat(c.light()).isEqualTo("GREEN"));
            List<Check> c2 = situ.checks(T2, interview(), interviewItems(), null);
            assertThat(c2).extracting(Check::key).containsExactly("SCRIPT", "LENGTH", "ANSWERS", "ORDER", "PARAPHRASE");
            assertThat(light(c2, "SCRIPT")).isEqualTo("GREEN");
            assertThat(light(c2, "ANSWERS")).isEqualTo("GREEN");
            assertThat(light(c2, "ORDER")).isEqualTo("GREEN");
            List<Check> c3 = situ.checks(T3, segments(T3, true), segmentItems(T3, "richtig", "falsch", "richtig", "falsch", "richtig"), null);
            assertThat(c3).allSatisfy(c -> assertThat(c.light()).isEqualTo("GREEN"));
        }

        @Test
        @DisplayName("mọi câu cùng một đáp án ⇒ ANSWERS đỏ; lệch 4/1 ⇒ vàng")
        void answersRed() {
            Text t = segments(T1, false);
            assertThat(light(situ.checks(T1, t, segmentItems(T1, "falsch", "falsch", "falsch", "falsch", "falsch"), null), "ANSWERS"))
                    .isEqualTo("RED");
            assertThat(light(situ.checks(T1, t, segmentItems(T1, "richtig", "richtig", "richtig", "richtig", "falsch"), null), "ANSWERS"))
                    .isEqualTo("YELLOW");
        }

        @Test
        @DisplayName("thiếu câu khung (T1), thiếu câu dẫn (T3), thiếu đoạn, phỏng vấn một giọng ⇒ SCRIPT đỏ")
        void scriptRed() {
            Text t1 = segments(T1, false);
            Text noFraming = new Text("", "", t1.context(), List.of(), null, null, null, null, null, null, t1.audioTurns(), " ");
            List<Item> five = segmentItems(T1, "falsch", "richtig", "richtig", "falsch", "falsch");
            assertThat(light(situ.checks(T1, noFraming, five, null), "SCRIPT")).isEqualTo("RED");
            assertThat(light(situ.checks(T3, segments(T3, false), segmentItems(T3, "richtig", "falsch", "richtig", "falsch", "richtig"), null),
                    "SCRIPT")).isEqualTo("RED");
            Text four = t1.withAudio(t1.audioTurns().subList(0, 4), HoerenTeile.contextOf(t1.audioTurns().subList(0, 4)));
            assertThat(light(situ.checks(T1, four, five, null), "SCRIPT")).isEqualTo("RED");
            // Câu của đoạn không còn ⇒ sai khuôn.
            assertThat(situ.formatOk(T1, four, five.get(4))).isFalse();
            assertThat(situ.formatOk(T1, four, five.get(3))).isTrue();
            assertThat(situ.formatOk(T1, t1, tf("HV1-41", "q", "vielleicht", ""))).isFalse();

            List<AudioTurn> mono = interview().audioTurns().stream().map(a -> new AudioTurn("PRUEFER", a.name(), a.text(), null)).toList();
            Text oneVoice = interview().withAudio(mono, HoerenTeile.contextOf(mono));
            assertThat(light(situ.checks(T2, oneVoice, interviewItems(), null), "SCRIPT")).isEqualTo("RED");
        }

        @Test
        @DisplayName("độ dài: đoạn ngoài khuôn là vàng, đoạn quá ngắn là đỏ; phỏng vấn ngắn hẳn là đỏ")
        void length() {
            Text t1 = segments(T1, false);
            List<AudioTurn> turns = new ArrayList<>(t1.audioTurns());
            turns.set(2, new AudioTurn("PRUEFER", null, words(50, "k"), null));
            List<Item> five = segmentItems(T1, "falsch", "richtig", "richtig", "falsch", "falsch");
            assertThat(light(situ.checks(T1, t1.withAudio(turns, HoerenTeile.contextOf(turns)), five, null), "LENGTH")).isEqualTo("YELLOW");
            turns.set(2, new AudioTurn("PRUEFER", null, "Nur ganz kurz.", null));
            assertThat(light(situ.checks(T1, t1.withAudio(turns, HoerenTeile.contextOf(turns)), five, null), "LENGTH")).isEqualTo("RED");

            List<AudioTurn> shortTalk = interview().audioTurns().subList(0, 6);
            Text shortInterview = interview().withAudio(shortTalk, HoerenTeile.contextOf(shortTalk));
            assertThat(TextChecks.wordCount(shortInterview.context())).isLessThan(300);
            assertThat(light(situ.checks(T2, shortInterview, interviewItems(), null), "LENGTH")).isEqualTo("RED");
        }

        @Test
        @DisplayName("mệnh đề chép nguyên văn lời thoại ⇒ PARAPHRASE vàng; câu sai thứ tự bài ⇒ ORDER vàng")
        void paraphraseAndOrder() {
            Text t = interview();
            List<Item> items = new ArrayList<>(interviewItems());
            items.set(0, tf("HV2-46", "Frage Nummer 0 an den Gast und mehr.", "richtig", "Antwort Nummer 0 ist hier."));
            List<Check> checks = situ.checks(T2, t, items, null);
            assertThat(light(checks, "PARAPHRASE")).isEqualTo("YELLOW");
            assertThat(checks.stream().filter(c -> c.key().equals("PARAPHRASE")).findFirst().orElseThrow().detail()).contains("HV2-46");
            assertThat(HoerenTeile.longestCommonRun(List.of("a", "b", "c", "x"), List.of("z", "a", "b", "c", "d"))).isEqualTo(3);

            items = new ArrayList<>(interviewItems());
            items.set(9, tf("HV2-55", "Herr Vogel sagt etwas ganz am Anfang.", "falsch", "Antwort Nummer 0 ist hier."));
            assertThat(light(situ.checks(T2, t, items, null), "ORDER")).isEqualTo("YELLOW");
        }

        @Test
        @DisplayName("xếp câu Teil 2 theo vị trí bằng chứng rồi đánh số lại 46–55")
        void inScriptOrder() {
            Text t = interview();
            List<Item> shuffled = new ArrayList<>();
            int[] order = {4, 0, 3, 1, 2};
            for (int i = 0; i < 5; i++) {
                shuffled.add(tf(T2.itemId(i), "Aussage zu Antwort " + order[i], "richtig", "Antwort Nummer " + order[i] + " ist hier."));
            }
            List<Item> sorted = HoerenTeile.inScriptOrder(T2, t.context(), shuffled);
            assertThat(sorted).extracting(Item::id).containsExactly("HV2-46", "HV2-47", "HV2-48", "HV2-49", "HV2-50");
            assertThat(sorted).extracting(Item::question).containsExactly("Aussage zu Antwort 0", "Aussage zu Antwort 1",
                    "Aussage zu Antwort 2", "Aussage zu Antwort 3", "Aussage zu Antwort 4");
            // Thiếu một câu: giữ nguyên, lần sinh sau lấp chỗ trống.
            List<Item> withHole = new ArrayList<>(shuffled);
            withHole.set(2, null);
            assertThat(HoerenTeile.inScriptOrder(T2, t.context(), withHole)).isSameAs(withHole);
        }

        @Test
        @DisplayName("đề đưa AI giải: T1/T3 ghép từng mệnh đề với đúng đoạn của nó; không lộ đáp án khi giải thử")
        void solverBlock() {
            Text t3 = segments(T3, true);
            List<Item> items = segmentItems(T3, "richtig", "falsch", "richtig", "falsch", "richtig");
            String blind = situ.solverBlock(T3, t3, items, false);
            assertThat(blind).contains("HÖRTEXT HV3-57 (Sprecher) — Sie hören eine Durchsage Nummer 1.")
                    .contains("AUSSAGE HV3-57: Die Person 1 macht etwas ganz anderes.").doesNotContain("Lösung:");
            assertThat(blind.indexOf("Satz eins von Person 1.")).isLessThan(blind.indexOf("AUSSAGE HV3-57"))
                    .isGreaterThan(blind.indexOf("AUSSAGE HV3-56"));
            assertThat(situ.solverBlock(T3, t3, items, true)).contains("Lösung: falsch");
            String talk = situ.solverBlock(T2, interview(), interviewItems(), false);
            assertThat(talk).contains("Moderatorin: Frage Nummer 0 an den Gast?").contains("Herr Vogel: Antwort Nummer 0")
                    .contains("HV2-55: Herr Vogel sagt etwas zum Punkt 9.").doesNotContain("Lösung:");
        }
    }

    @Nested
    @DisplayName("Lưu bản nháp")
    class Storage {
        @Test
        @DisplayName("text_json của bản nháp cũ (không có audioTurns) vẫn đọc được; bản nháp Nghe đi vòng JSON không mất gì")
        void jsonBackwardCompatible() throws Exception {
            String old = """
                    {"text": {"titleDe": "Schlaf", "vorspannDe": "", "context": "Ein Text.", "glossary": [],
                              "ads": null, "examples": null, "stimulusAd": null, "wordBank": null, "stimulus": null,
                              "writingPoints": null}, "usedFactIds": ["s1f1"]}
                    """;
            ExamDraftService.StoredText st = mapper.readValue(old, ExamDraftService.StoredText.class);
            assertThat(st.text().titleDe()).isEqualTo("Schlaf");
            assertThat(st.text().audioTurns()).isNull();
            assertThat(st.text().framingDe()).isNull();

            Text t = segments(T3, true);
            String json = mapper.writeValueAsString(new ExamDraftService.StoredText(t, List.of()));
            assertThat(json).contains("\"audioTurns\"").contains("\"leadInDe\"");
            assertThat(mapper.readValue(json, ExamDraftService.StoredText.class).text()).isEqualTo(t);
            // Các hàm with* của Text giữ lời thoại.
            assertThat(t.withContext("x").audioTurns()).isEqualTo(t.audioTurns());
            assertThat(t.withWordBank(Map.of()).audioTurns()).isEqualTo(t.audioTurns());
        }

        @Test
        @DisplayName("sửa tay: context ghép lại từ lời thoại, khoá giọng lạ về giọng nữ, lượt trống của Teil 2 bị bỏ")
        void sanitized() {
            List<AudioTurn> turns = List.of(new AudioTurn("partner", " Herr Vogel ", "  Guten Tag.  ", " "),
                    new AudioTurn("???", "Moderatorin", "Hallo.", null), new AudioTurn("PRUEFER", "Moderatorin", "   ", null));
            Text in = new Text("Show", "", "CONTEXT CŨ", List.of(), null, null, null, null, null, null, turns, " ");
            Text out = HoerenTeile.sanitized(T2, in);
            assertThat(out.audioTurns()).containsExactly(new AudioTurn("PARTNER", "Herr Vogel", "Guten Tag.", null),
                    new AudioTurn("PRUEFER", "Moderatorin", "Hallo.", null));
            assertThat(out.context()).isEqualTo("Guten Tag.\n\nHallo.");
            assertThat(out.framingDe()).isNull();
            // Teil 1/3: đoạn trống được GIỮ chỗ (đoạn thứ n đi với câu thứ n), đèn SCRIPT sẽ báo.
            assertThat(HoerenTeile.sanitized(T1, in).audioTurns()).hasSize(3);
            // Bài không có lời thoại (Teil khác) thì để nguyên.
            Text plain = new Text("", "", "abc", List.of());
            assertThat(HoerenTeile.sanitized(T1, plain)).isSameAs(plain);
        }

        @Test
        @DisplayName("AI viết lại một đoạn bôi đen: thay trong lượt lời và trong context")
        void replaced() {
            Text t = interview();
            Text r = HoerenTeile.replaced(t, "Frage Nummer 2 an den Gast?", "Und wie ging es weiter?");
            assertThat(r.audioTurns().get(4).text()).isEqualTo("Und wie ging es weiter?");
            assertThat(r.context()).contains("Und wie ging es weiter?").doesNotContain("Frage Nummer 2 an den Gast?");
            assertThat(r.audioTurns().get(0)).isEqualTo(t.audioTurns().get(0));
            Text plain = new Text("", "", "Alt und gut.", List.of());
            assertThat(HoerenTeile.replaced(plain, "Alt", "Neu").context()).isEqualTo("Neu und gut.");
        }
    }

    @Nested
    @DisplayName("Ghép bộ đề và duyệt cả bộ")
    class Assembly {
        @Test
        @DisplayName("ô Nghe của đề viết tay không khai type: nhận Teil kho dạng HOEREN_*; ô có type thì phải khớp")
        void typeMatches() {
            assertThat(ExamAssemblyService.typeMatches("", "HOEREN_STATEMENTS")).isTrue();
            assertThat(ExamAssemblyService.typeMatches(null, "HOEREN_INTERVIEW")).isTrue();
            assertThat(ExamAssemblyService.typeMatches("", "WRITE_EMAIL")).isTrue();
            assertThat(ExamAssemblyService.typeMatches("", "MULTIPLE_CHOICE")).isFalse();
            assertThat(ExamAssemblyService.typeMatches("MATCH_AD_X", "MATCH_AD_X")).isTrue();
            assertThat(ExamAssemblyService.typeMatches("MATCH_AD_X", "HOEREN_STATEMENTS")).isFalse();
        }

        @Test
        @DisplayName("thay cả ba Teil Nghe: phần Nghe của bộ đề không còn chữ nào của đề nền; phần khác giữ nguyên")
        @SuppressWarnings("unchecked")
        void allThreeReplaced() throws Exception {
            String baseSections = """
                    {"format": "TELC", "sections": [
                      {"name": "LESEN", "teile": [{"teil": 2, "type": "MULTIPLE_CHOICE", "title_de": "Lesen der Basis", "items": []}]},
                      {"name": "HOEREN", "label_vi": "Nghe", "time_minutes": 30, "max_points": 75, "teile": [
                        {"teil": 1, "max_plays": 1, "framing_de": "ALT Rahmen", "items": [{"id": "HV1-41", "audio_script": "ALT eins", "correct": "falsch"}]},
                        {"teil": 2, "max_plays": 2, "audio_script": [{"speaker": "PRUEFER", "name": "Moderatorin", "text": "ALT zwei"}],
                         "items": [{"id": "HV2-46", "question": "ALT Frage", "correct": "richtig"}]},
                        {"teil": 3, "max_plays": 2, "items": [{"id": "HV3-56", "lead_in_de": "ALT Lead", "audio_script": "ALT drei", "correct": "richtig"}]}]},
                      {"name": "SCHREIBEN", "teile": [{"teil": 1, "prompt": "Schreiben der Basis"}]}]}
                    """;
            JdbcTemplate jdbc = mock(JdbcTemplate.class);
            ExamAssemblyService service = new ExamAssemblyService(jdbc, mapper);
            Map<String, Object> base = new HashMap<>();
            base.put("id", 4L);
            base.put("cefr_level", "B1");
            base.put("exam_format", "TELC");
            base.put("title", "telc Deutsch B1 — Đề số 1");
            base.put("description_vi", "Đề thi thử.");
            base.put("sections", baseSections);
            base.put("total_points", 300);
            base.put("pass_points", 180);
            base.put("time_limit_minutes", 150);
            base.put("origin", "HANDWRITTEN");
            base.put("is_active", true);
            when(jdbc.queryForList(contains("FROM mock_exams WHERE id = ?"), eq(4L))).thenReturn(List.of(base));
            List<Map<String, Object>> contents = List.of(
                    situ.content(T1, segments(T1, false), segmentItems(T1, "falsch", "richtig", "richtig", "falsch", "falsch")),
                    situ.content(T2, interview(), interviewItems()),
                    situ.content(T3, segments(T3, true), segmentItems(T3, "richtig", "falsch", "richtig", "falsch", "richtig")));
            List<TeilSpec> specs = List.of(T1, T2, T3);
            List<ExamAssemblyService.Replacement> reps = new ArrayList<>();
            for (int i = 0; i < 3; i++) {
                Map<String, Object> block = new HashMap<>();
                block.put("exam_format", "TELC");
                block.put("cefr_level", "B1");
                block.put("section", "HOEREN");
                block.put("teil", i + 1);
                block.put("teil_type", specs.get(i).teilType());
                block.put("status", "APPROVED");
                block.put("content", mapper.writeValueAsString(contents.get(i)));
                when(jdbc.queryForList(contains("FROM exam_teil_blocks WHERE id = ?"), eq(70L + i))).thenReturn(List.of(block));
                reps.add(new ExamAssemblyService.Replacement("HOEREN", i + 1, 70L + i));
            }
            when(jdbc.queryForObject(contains("INSERT INTO mock_exams"), eq(Long.class), any(Object[].class))).thenReturn(99L);
            when(jdbc.query(contains("FROM mock_exams WHERE id = ? AND origin = 'STUDIO'"), any(RowMapper.class), eq(99L)))
                    .thenReturn(List.of(new ExamAssemblyService.Assembled(99, "Bộ 5", "B1", "TELC", false, true, 4L, List.of(), null)));

            service.assemble(new ExamAssemblyService.AssembleRequest(4L, "Bộ 5", reps));

            ArgumentCaptor<Object[]> args = ArgumentCaptor.forClass(Object[].class);
            verify(jdbc).queryForObject(contains("INSERT INTO mock_exams"), eq(Long.class), args.capture());
            String sectionsJson = (String) args.getValue()[4];
            JsonNode sections = mapper.readTree(sectionsJson).path("sections");
            JsonNode hoeren = sections.get(1);
            // Khung của phần (nhãn, giờ, điểm) vẫn là của đề nền; nội dung ba Teil là của kho.
            assertThat(hoeren.path("name").asText()).isEqualTo("HOEREN");
            assertThat(hoeren.path("max_points").asInt()).isEqualTo(75);
            assertThat(hoeren.toString()).doesNotContain("ALT");
            assertThat(hoeren.path("teile")).hasSize(3);
            assertThat(hoeren.path("teile").get(0).path("items").get(0).path("audio_script").asText()).startsWith("Nummer 41. ");
            assertThat(hoeren.path("teile").get(0).path("framing_de").asText()).contains("Wir haben fünf Personen gefragt");
            assertThat(hoeren.path("teile").get(1).path("audio_script")).hasSize(10);
            assertThat(hoeren.path("teile").get(1).path("teil").asInt()).isEqualTo(2);
            assertThat(hoeren.path("teile").get(2).path("items").get(4).path("lead_in_de").asText())
                    .startsWith("Lesen Sie jetzt die Aufgabe 60. ");
            assertThat(sections.get(0).toString()).contains("Lesen der Basis");
            assertThat(sections.get(2).toString()).contains("Schreiben der Basis");
        }

        @Test
        @DisplayName("kiểm cấp bộ: Teil richtig/falsch 5 câu trùng chuỗi đáp án với đề khác không bị báo; Teil 10 câu thì có")
        void answerKeyNoise() {
            assertThat(ExamSetChecks.shortTrueFalseKey("richtigfalschfalschrichtigfalsch")).isTrue();
            assertThat(ExamSetChecks.shortTrueFalseKey("richtigfalsch".repeat(5))).isFalse();
            assertThat(ExamSetChecks.shortTrueFalseKey("abcab")).isFalse();
            String five = "falschrichtigrichtigfalschfalsch";
            String ten = "richtigfalsch".repeat(5);
            List<ExamSetChecks.TeilDoc> set = List.of(
                    new ExamSetChecks.TeilDoc("HOEREN#1", "HOEREN 1", "Medien", "eins", List.of("a"), five, Map.of(), Map.of()),
                    new ExamSetChecks.TeilDoc("HOEREN#2", "HOEREN 2", "Kleidung", "zwei", List.of("b"), ten, Map.of(), Map.of()));
            List<ExamSetChecks.Other> corpus = List.of(
                    new ExamSetChecks.Other("đề số 1 (HOEREN 1)", "HOEREN#1", "drei", List.of("c"), five),
                    new ExamSetChecks.Other("đề số 1 (HOEREN 2)", "HOEREN#2", "vier", List.of("d"), ten));
            Check keys = ExamSetChecks.run(set, corpus).stream().filter(c -> c.key().equals("SET_ANSWER_KEYS")).findFirst().orElseThrow();
            assertThat(keys.light()).isEqualTo("YELLOW");
            assertThat(keys.detail()).contains("HOEREN 2").doesNotContain("HOEREN 1 có chuỗi");
        }

        @Test
        @DisplayName("ghi chú lượt đã duyệt: chỉ nói phần Nghe lấy từ đề nền khi lượt không có Teil Nghe")
        void approvalNote() {
            assertThat(ExamSetRunService.approvalNote("telc Deutsch B1 — Đề số 1", true)).isEqualTo("Đề nền: telc Deutsch B1 — Đề số 1");
            assertThat(ExamSetRunService.approvalNote("telc Deutsch B1 — Đề số 1", false))
                    .startsWith("Đề nền: telc Deutsch B1 — Đề số 1").contains("phần Nghe lấy nguyên từ đề nền");
        }
    }
}
