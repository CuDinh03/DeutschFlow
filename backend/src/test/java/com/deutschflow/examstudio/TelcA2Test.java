package com.deutschflow.examstudio;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.examstudio.ExamStudioDtos.*;
import com.deutschflow.grammar.service.ExamScoringService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DisplayName("Xưởng đề đợt 4 — telc A2 / Start Deutsch 2")
class TelcA2Test {

    private final SituationalTeile situ = new SituationalTeile(null);
    private final ObjectMapper om = new ObjectMapper();

    private static TeilSpec spec(String section, int teil) {
        return TeilSpec.find("TELC", "A2", section, teil).orElseThrow();
    }

    @Nested
    @DisplayName("Luật chấm ô form (telc A1/A2 Schreiben Teil 1)")
    class FormAnswers {
        @Test
        void spellingToleratedNumbersExact() {
            assertThat(ExamScoringService.formAnswerMatches("Donerstach", List.of("Donnerstag"))).isTrue();
            assertThat(ExamScoringService.formAnswerMatches("donnastag", List.of("Donnerstag"))).isTrue();
            assertThat(ExamScoringService.formAnswerMatches("Freitag", List.of("Donnerstag"))).isFalse();
            assertThat(ExamScoringService.formAnswerMatches("500 548 10", List.of("50054810"))).isTrue();
            assertThat(ExamScoringService.formAnswerMatches("500 549 01", List.of("500 548 10"))).isFalse();
            assertThat(ExamScoringService.formAnswerMatches("Do.", List.of("Donnerstag", "Do"))).isTrue();
            assertThat(ExamScoringService.formAnswerMatches("  ", List.of("Bremen"))).isFalse();
        }
    }

    @Nested
    @DisplayName("Phiếu chấm Viết telc A2")
    class Rubric {
        @Test
        @DisplayName("3 ý × 3 + K 1 = 10; ý thứ tư không cộng thêm; điểm lạ quy về bậc hợp lệ")
        void verdict() throws Exception {
            JsonNode n = om.readTree("""
                    {"points": [{"point":"Grund","score":3},{"point":"Geschenk","score":2.5},
                                {"point":"Termin","score":1},{"point":"Gruß","score":3}], "k": 0.8}""");
            Map<String, Object> v = invokeVerdict(n);
            assertThat(v).containsEntry("total", 10.0).containsEntry("max", 10).containsEntry("status", "AI_EVALUATED");
            JsonNode half = om.readTree("{\"points\": [{\"score\":3},{\"score\":1.5}], \"k\": 0.5}");
            assertThat(invokeVerdict(half)).containsEntry("total", 5.0);
        }

        @SuppressWarnings("unchecked")
        private Map<String, Object> invokeVerdict(JsonNode n) throws Exception {
            var m = com.deutschflow.grammar.service.AiExamEvaluatorService.class.getDeclaredMethod("telcA2Verdict", JsonNode.class);
            m.setAccessible(true);
            return (Map<String, Object>) m.invoke(null, n);
        }
    }

    @Nested
    @DisplayName("Khuôn 5 Teil A2")
    class Content {
        @Test
        void specs() {
            assertThat(spec("LESEN", 1).outputType()).isEqualTo("MULTIPLE_CHOICE");
            assertThat(spec("LESEN", 3).xCount()).isEqualTo(1);
            assertThat(spec("LESEN", 3).adLetters()).hasSize(8).endsWith("h");
            assertThat(spec("SCHREIBEN", 2).writing()).isTrue();
            assertThat(spec("LESEN", 2).situational()).isTrue();
            assertThat(spec("LESEN", 2).itemId(0)).isEqualTo("LV2-6");
        }

        @Test
        void lesen1And2() {
            Text info = new Text("Kaufhaus Weber", "", "EG: Lebensmittel\n1. Stock: Damenmode", List.of());
            Item mc = new Item("LV1-1", "Sie möchten Brot kaufen.", Map.of("a", "EG", "b", "1. Stock", "c", "2. Stock"),
                    "a", "vi", "EG: Lebensmittel", List.of(), "EASY", null, false, null, List.of());
            Map<String, Object> c1 = situ.content(spec("LESEN", 1), info, List.of(mc));
            assertThat(c1).containsEntry("type", "MULTIPLE_CHOICE").containsEntry("point_per_item", 1)
                    .containsEntry("context", "EG: Lebensmittel\n1. Stock: Damenmode").containsEntry("title_de", "Kaufhaus Weber");

            Text t = new Text("Liebe Anna", "", "Ich bin umgezogen.", List.of());
            Item rf = new Item("LV2-6", "Anna ist umgezogen.", Map.of("richtig", "richtig", "falsch", "falsch"), "falsch",
                    "vi", "Ich bin umgezogen.", List.of(), "EASY", null, false, null, List.of());
            assertThat(situ.formatOk(spec("LESEN", 2), t, rf)).isTrue();
            Map<String, Object> c2 = situ.content(spec("LESEN", 2), t, List.of(rf));
            assertThat(c2).containsEntry("type", "TRUE_FALSE");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> its = (List<Map<String, Object>>) c2.get("items");
            assertThat(its.get(0)).containsEntry("correct", "falsch").doesNotContainKey("options");
        }

        @Test
        @DisplayName("Schreiben 1: form_fields mang đáp án + cách viết chấp nhận; khai max_points 5")
        void schreiben1Form() {
            Text t = new Text("Anmeldung Sprachkurs", "", "Miguel wohnt in der Gartenstraße 5, Telefon 0421 55 66.", List.of());
            Item f = new Item("SA1-1", "Telefon", Map.of(), "0421 55 66", "vi", "Telefon 0421 55 66", List.of(), "EASY",
                    null, false, null, List.of(), Map.of("accept", "042155 66"));
            Map<String, Object> c = situ.content(spec("SCHREIBEN", 1), t, List.of(f));
            assertThat(c).containsEntry("type", "FILL_FORM").containsEntry("max_points", 5).containsEntry("form_title", "Anmeldung Sprachkurs")
                    .doesNotContainKey("items");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> fields = (List<Map<String, Object>>) c.get("form_fields");
            assertThat(fields.get(0)).containsEntry("field", "Telefon").containsEntry("answer", "0421 55 66")
                    .containsEntry("accept", List.of("042155 66"));
            assertThat(ExamDraftService.sameAnswer(spec("SCHREIBEN", 1), f, "0421-5566")).isTrue();
            assertThat(ExamDraftService.sameAnswer(spec("SCHREIBEN", 1), f, "0421 55 67")).isFalse();
        }

        @Test
        void schreiben2Note() {
            Text t = new Text("", "", "Sie können nicht zur Party kommen.", List.of(), null, null, null, null,
                    new Stimulus("SITUATION", null, "Party", "Sie können nicht zur Party kommen."), List.of("Grund", "Geschenk", "Termin", "Gruß"));
            Map<String, Object> c = situ.content(spec("SCHREIBEN", 2), t, List.of());
            assertThat(c).containsEntry("choose_points", 3).containsEntry("word_target", 40).containsEntry("max_points", 10);
            assertThat(situ.checks(spec("SCHREIBEN", 2), t, List.of(), null)).extracting(Check::key)
                    .contains("POINTS").doesNotContain("DU");
        }

        @Test
        @DisplayName("Lesen 3 A2: 8 mẩu, đúng 1 câu x, 1 ví dụ")
        void lesen3() {
            Map<String, String> ads = new LinkedHashMap<>();
            for (String l : spec("LESEN", 3).adLetters()) ads.put(l, "Anzeige " + l + " mit genug Wörtern für den Test hier");
            Text t = new Text("", "", "", List.of(), ads, List.of(new Example("01", "Sie suchen …", "h")), null, null, null, null);
            List<Item> items = new ArrayList<>();
            for (int i = 0; i < 5; i++) {
                items.add(new Item(spec("LESEN", 3).itemId(i), "S" + i, Map.of(), i < 4 ? String.valueOf((char) ('a' + i)) : "x",
                        "", "", List.of(), "EASY", null, false, null, List.of()));
            }
            List<Check> checks = situ.checks(spec("LESEN", 3), t, items, null);
            assertThat(checks).filteredOn(c -> Set.of("X_COUNT", "ADS_UNIQUE", "EXAMPLES").contains(c.key()))
                    .allSatisfy(c -> assertThat(c.light()).isEqualTo("GREEN"));
        }
    }

    @Nested
    @DisplayName("Ghép từ khung telc A2")
    class Blueprint {
        @Test
        void needsEveryTeil() {
            JdbcTemplate jdbc = mock(JdbcTemplate.class);
            ExamAssemblyService svc = new ExamAssemblyService(jdbc, new ObjectMapper());
            assertThatThrownBy(() -> svc.assembleFromBlueprint(new ExamAssemblyService.BlueprintAssembleRequest(
                    "TELC", "A2", "Bộ A2 số 1", List.of(new ExamAssemblyService.Replacement("LESEN", 1, 1L)), false)))
                    .isInstanceOf(BadRequestException.class).hasMessageContaining("còn thiếu").hasMessageContaining("SCHREIBEN Teil 2");
            assertThatThrownBy(() -> svc.assembleFromBlueprint(new ExamAssemblyService.BlueprintAssembleRequest(
                    "TELC", "C1", "x", List.of(), false))).hasMessageContaining("Chưa có khung");
        }

        @Test
        @SuppressWarnings("unchecked")
        @DisplayName("đủ 5 Teil ⇒ đề STUDIO 'Sắp có', 30 điểm, đỗ 18, khối Đọc+Viết 50 phút")
        void builds() throws Exception {
            JdbcTemplate jdbc = mock(JdbcTemplate.class);
            ExamAssemblyService svc = new ExamAssemblyService(jdbc, new ObjectMapper());
            long[] ids = {11, 12, 13, 14, 15};
            String[][] slots = {{"LESEN", "1"}, {"LESEN", "2"}, {"LESEN", "3"}, {"SCHREIBEN", "1"}, {"SCHREIBEN", "2"}};
            List<ExamAssemblyService.Replacement> reps = new ArrayList<>();
            for (int i = 0; i < 5; i++) {
                reps.add(new ExamAssemblyService.Replacement(slots[i][0], Integer.parseInt(slots[i][1]), ids[i]));
                Map<String, Object> row = new HashMap<>();
                row.put("exam_format", "TELC");
                row.put("cefr_level", "A2");
                row.put("section", slots[i][0]);
                row.put("teil", Integer.parseInt(slots[i][1]));
                row.put("status", "APPROVED");
                row.put("content", "{\"teil\": 9, \"type\": \"X\", \"marker\": " + ids[i] + "}");
                when(jdbc.queryForList(contains("FROM exam_teil_blocks WHERE id = ?"), eq(ids[i]))).thenReturn(List.of(row));
            }
            when(jdbc.queryForObject(contains("INSERT INTO mock_exams"), eq(Long.class), any(Object[].class))).thenReturn(77L);
            when(jdbc.query(contains("FROM mock_exams WHERE id = ? AND origin = 'STUDIO'"), any(RowMapper.class), eq(77L)))
                    .thenReturn(List.of(new ExamAssemblyService.Assembled(77, "Bộ A2 số 1", "A2", "TELC", false, true, null, List.of(), null)));
            var a = svc.assembleFromBlueprint(new ExamAssemblyService.BlueprintAssembleRequest("TELC", "A2", "Bộ A2 số 1", reps, false));
            assertThat(a.id()).isEqualTo(77);
            ArgumentCaptor<Object[]> args = ArgumentCaptor.forClass(Object[].class);
            verify(jdbc).queryForObject(contains("INSERT INTO mock_exams"), eq(Long.class), args.capture());
            Object[] v = args.getValue();
            assertThat(v[0]).isEqualTo("A2");
            assertThat(v[5]).isEqualTo(30);
            assertThat(v[6]).isEqualTo(18);
            JsonNode sections = new ObjectMapper().readTree((String) v[4]);
            assertThat(sections.path("format").asText()).isEqualTo("TELC");
            assertThat(sections.path("sections").get(0).path("teile").get(2).path("marker").asLong()).isEqualTo(13);
            assertThat(sections.path("sections").get(0).path("teile").get(2).path("teil").asInt()).isEqualTo(3);
            assertThat(sections.path("sections").get(1).path("max_points").asInt()).isEqualTo(15);
        }
    }
}
