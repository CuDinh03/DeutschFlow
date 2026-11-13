package com.deutschflow.examstudio;

import com.deutschflow.common.exception.BadRequestException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DisplayName("Xưởng đề — ghép bộ đề từ kho")
class ExamAssemblyServiceTest {

    static final String BASE_SECTIONS = """
            {"format": "TELC", "blocks": [{"id": "LV_SB", "minutes": 90}],
             "pass_rule": {"written": 135},
             "sections": [
               {"name": "LESEN", "max_points": 75, "teile": [
                 {"teil": 1, "type": "MATCH_HEADLINE", "items": [{"id": "LV1-1"}]},
                 {"teil": 2, "type": "MULTIPLE_CHOICE", "title_de": "Alter Text", "items": [{"id": "LV2-6"}]},
                 {"teil": 3, "type": "MATCH_AD_X", "items": []}]},
               {"name": "HOEREN", "teile": [{"teil": 1, "items": []}]}]}
            """;

    static final String BLOCK = """
            {"teil": 2, "type": "MULTIPLE_CHOICE", "title_de": "Zu wenig Schlaf", "context_lines": true,
             "source": {"quelle": "Daten: X · Text neu geschrieben."},
             "items": [{"id": "LV2-6", "correct": "b", "difficulty_target": "EASY"}]}
            """;

    private JdbcTemplate jdbc;
    private ExamAssemblyService service;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        service = new ExamAssemblyService(jdbc, mapper);
    }

    private void stubBaseAndBlock(String blockSection, int blockTeil, String blockType, String status) {
        Map<String, Object> base = new HashMap<>();
        base.put("id", 4L);
        base.put("cefr_level", "B1");
        base.put("exam_format", "TELC");
        base.put("title", "telc Deutsch B1 — Đề số 1");
        base.put("description_vi", "Đề thi thử.");
        base.put("sections", BASE_SECTIONS);
        base.put("total_points", 225);
        base.put("pass_points", 135);
        base.put("time_limit_minutes", 170);
        base.put("origin", "HANDWRITTEN");
        base.put("is_active", true);
        when(jdbc.queryForList(contains("FROM mock_exams WHERE id = ?"), eq(4L))).thenReturn(List.of(base));
        Map<String, Object> block = new HashMap<>();
        block.put("exam_format", "TELC");
        block.put("cefr_level", "B1");
        block.put("section", blockSection);
        block.put("teil", blockTeil);
        block.put("teil_type", blockType);
        block.put("status", status);
        block.put("content", BLOCK);
        when(jdbc.queryForList(contains("FROM exam_teil_blocks WHERE id = ?"), eq(7L))).thenReturn(List.of(block));
    }

    @Test
    @SuppressWarnings("unchecked")
    @DisplayName("thay đúng Teil, giữ phần còn lại của đề nền, lưu bản chụp STUDIO chưa phát hành")
    void replacesOnlyTheChosenTeil() throws Exception {
        stubBaseAndBlock("LESEN", 2, "MULTIPLE_CHOICE", "APPROVED");
        when(jdbc.queryForObject(contains("INSERT INTO mock_exams"), eq(Long.class), any(Object[].class))).thenReturn(99L);
        when(jdbc.query(contains("FROM mock_exams WHERE id = ? AND origin = 'STUDIO'"), any(RowMapper.class), eq(99L)))
                .thenReturn(List.of(new ExamAssemblyService.Assembled(99, "telc B1 — Bộ 5", "B1", "TELC", false, true,
                        4L, List.of(), null)));

        var a = service.assemble(new ExamAssemblyService.AssembleRequest(4L, "telc B1 — Bộ 5",
                List.of(new ExamAssemblyService.Replacement("LESEN", 2, 7L))));
        assertThat(a.id()).isEqualTo(99);

        ArgumentCaptor<Object[]> args = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).queryForObject(contains("INSERT INTO mock_exams"), eq(Long.class), args.capture());
        Object[] v = args.getValue();
        // (level, format, title, desc, sections, total, pass, minutes, block_ids)
        assertThat(v[2]).isEqualTo("telc B1 — Bộ 5");
        assertThat(v[5]).isEqualTo(225);
        JsonNode sections = mapper.readTree((String) v[4]);
        JsonNode lesen = sections.path("sections").get(0).path("teile");
        assertThat(lesen.get(1).path("title_de").asText()).isEqualTo("Zu wenig Schlaf");
        assertThat(lesen.get(1).path("source").path("quelle").asText()).startsWith("Daten:");
        assertThat(lesen.get(1).path("teil").asInt()).isEqualTo(2);
        assertThat(lesen.get(0).path("type").asText()).isEqualTo("MATCH_HEADLINE");
        assertThat(sections.path("pass_rule").path("written").asInt()).isEqualTo(135);
        JsonNode trace = mapper.readTree((String) v[8]);
        assertThat(trace.path("baseExamId").asLong()).isEqualTo(4L);
        assertThat(trace.path("teile").get(0).path("blockId").asLong()).isEqualTo(7L);
        verify(jdbc).update(contains("exposure_count = exposure_count + 1"), eq(7L));
    }

    @Test
    void rejectsBlockOfAnotherSlotOrRetired() {
        stubBaseAndBlock("LESEN", 1, "MATCH_HEADLINE", "APPROVED");
        assertThatThrownBy(() -> service.assemble(new ExamAssemblyService.AssembleRequest(4L, "x",
                List.of(new ExamAssemblyService.Replacement("LESEN", 2, 7L)))))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("không khớp")
                // Nêu Teil kho nào, ô nào và việc cần làm (owner yêu cầu 13/11/2026).
                .hasMessageContaining("Teil kho #7").hasMessageContaining("ô LESEN Teil 2").hasMessageContaining("Chọn lại");

        stubBaseAndBlock("LESEN", 2, "MULTIPLE_CHOICE", "RETIRED");
        assertThatThrownBy(() -> service.assemble(new ExamAssemblyService.AssembleRequest(4L, "x",
                List.of(new ExamAssemblyService.Replacement("LESEN", 2, 7L)))))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("đã gỡ")
                .hasMessageContaining("Teil kho #7").hasMessageContaining("Chọn Teil khác cho ô LESEN Teil 2");
    }

    @Test
    void needsBaseTitleAndAtLeastOneReplacement() {
        assertThatThrownBy(() -> service.assemble(new ExamAssemblyService.AssembleRequest(null, "x", List.of())))
                .hasMessageContaining("đề nền").hasMessageContaining("Ghép");
        assertThatThrownBy(() -> service.assemble(new ExamAssemblyService.AssembleRequest(4L, " ", List.of())))
                .hasMessageContaining("tên").hasMessageContaining("Tên bộ đề");
        assertThatThrownBy(() -> service.assemble(new ExamAssemblyService.AssembleRequest(4L, "x", List.of())))
                .hasMessageContaining("ít nhất một").hasMessageContaining("Ghép");
    }

    @Test
    void slotsOfListsEveryTeil() throws Exception {
        var slots = ExamAssemblyService.slotsOf(mapper.readTree(BASE_SECTIONS));
        assertThat(slots).extracting(ExamAssemblyService.Slot::section, ExamAssemblyService.Slot::teil)
                .contains(org.assertj.core.groups.Tuple.tuple("LESEN", 2), org.assertj.core.groups.Tuple.tuple("HOEREN", 1));
    }

    @Test
    @SuppressWarnings("unchecked")
    @DisplayName("chống trùng bộ đề: Teil kho đã nằm trong bộ đề đang chạy khác ⇒ 409, trừ khi bật allowReuse")
    void blockAlreadyUsedElsewhere() {
        stubBaseAndBlock("LESEN", 2, "MULTIPLE_CHOICE", "APPROVED");
        when(jdbc.queryForList(contains("jsonb_array_elements"), eq(7L)))
                .thenReturn(List.of(Map.of("id", 50L, "title", "telc B1 — Bộ 5")));
        assertThatThrownBy(() -> service.assemble(new ExamAssemblyService.AssembleRequest(4L, "Bộ 6",
                List.of(new ExamAssemblyService.Replacement("LESEN", 2, 7L)))))
                .isInstanceOf(com.deutschflow.common.exception.ConflictException.class)
                .hasMessageContaining("Bộ 5").hasMessageContaining("Cho dùng lại");

        when(jdbc.queryForObject(contains("INSERT INTO mock_exams"), eq(Long.class), any(Object[].class))).thenReturn(99L);
        when(jdbc.query(contains("FROM mock_exams WHERE id = ? AND origin = 'STUDIO'"), any(RowMapper.class), eq(99L)))
                .thenReturn(List.of(new ExamAssemblyService.Assembled(99, "Bộ 6", "B1", "TELC", false, true, 4L, List.of(), null)));
        var a = service.assemble(new ExamAssemblyService.AssembleRequest(4L, "Bộ 6",
                List.of(new ExamAssemblyService.Replacement("LESEN", 2, 7L)), true));
        assertThat(a.id()).isEqualTo(99);
    }

    @Test
    @SuppressWarnings("unchecked")
    @DisplayName("chống trùng bộ đề: ghép lại đúng bộ đã có (cùng nền, cùng Teil) ⇒ 409")
    void identicalAssemblyRejected() {
        stubBaseAndBlock("LESEN", 2, "MULTIPLE_CHOICE", "APPROVED");
        when(jdbc.query(contains("WHERE origin = 'STUDIO' ORDER BY id DESC"), any(RowMapper.class)))
                .thenReturn(List.of(new ExamAssemblyService.Assembled(50, "Bộ 5", "B1", "TELC", true, true, 4L,
                        List.of(Map.of("section", "LESEN", "teil", 2, "blockId", 7L)), null)));
        assertThatThrownBy(() -> service.assemble(new ExamAssemblyService.AssembleRequest(4L, "Bộ 6",
                List.of(new ExamAssemblyService.Replacement("LESEN", 2, 7L)), true)))
                .isInstanceOf(com.deutschflow.common.exception.ConflictException.class)
                .hasMessageContaining("đã có");
    }
}
