package com.deutschflow.examstudio;

import com.deutschflow.examstudio.ExamStudioDtos.Check;
import com.deutschflow.examstudio.ExamStudioDtos.Fact;
import com.deutschflow.examstudio.ExamStudioDtos.Source;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Xưởng đề — mục kiểm \"Bài khớp dữ kiện của nguồn\"")
class FaithfulCheckTest {

    private static final ObjectMapper OM = new ObjectMapper();

    private static JsonNode issues(String json) throws Exception {
        return OM.readTree(json).path("issues");
    }

    @Test
    @DisplayName("không có lỗi ⇒ đèn xanh, \"Máy: 0 câu cần xem\"")
    void clean() throws Exception {
        Check c = ExamDraftService.faithfulResult(issues("{\"issues\": []}"));
        assertThat(c.key()).isEqualTo("FAITHFUL");
        assertThat(c.light()).isEqualTo("GREEN");
        assertThat(c.count()).isZero();
        assertThat(c.detail()).isEqualTo("Máy: 0 câu cần xem");
    }

    @Test
    @DisplayName("chỉ lỗi nhẹ ⇒ vẫn xanh, số câu cần xem là 0, lỗi nhẹ nằm ở phần ghi chú")
    void minorOnly() throws Exception {
        Check c = ExamDraftService.faithfulResult(issues("""
                {"issues": [{"sentence": "Fast die Hälfte schläft zu wenig.", "type": "UNSUPPORTED",
                             "severity": "MINOR", "problemVi": "Làm tròn 48 % thành gần một nửa."}]}
                """));
        assertThat(c.light()).isEqualTo("GREEN");
        assertThat(c.count()).isZero();
        assertThat(c.detail()).startsWith("Máy: 0 câu cần xem\nGhi chú nhỏ, không tính (1):")
                .contains("Fast die Hälfte schläft zu wenig.");
    }

    @Test
    @DisplayName("lỗi nặng ⇒ vàng và được đếm; mức không ghi hoặc ghi lạ cũng coi là nặng")
    void serious() throws Exception {
        Check c = ExamDraftService.faithfulResult(issues("""
                {"issues": [
                  {"sentence": "Stress verursacht Schlafmangel.", "type": "CAUSAL", "severity": "SERIOUS",
                   "problemVi": "Nguồn chỉ nói có liên quan."},
                  {"sentence": "2021 waren es 70 Prozent.", "type": "UNSUPPORTED", "problemVi": "Không có số này."},
                  {"sentence": "Das gilt für Kinder.", "type": "WRONG_LINK", "severity": "hoch", "problemVi": "Nguồn nói về người lớn."},
                  {"sentence": "Viele schlafen schlecht.", "type": "UNSUPPORTED", "severity": "minor", "problemVi": "Nói gọn."},
                  {"type": "CAUSAL", "severity": "SERIOUS", "problemVi": "Thiếu câu trích nên bỏ qua."}
                ]}
                """));
        assertThat(c.light()).isEqualTo("YELLOW");
        assertThat(c.count()).isEqualTo(3);
        assertThat(c.detail()).startsWith("Máy: 3 câu cần xem\n• „Stress verursacht Schlafmangel.“ — Nguồn chỉ nói có liên quan.")
                .contains("Ghi chú nhỏ, không tính (1):").doesNotContain("Thiếu câu trích");
    }

    @Test
    @DisplayName("quá 8 lỗi nặng ⇒ nêu 8 câu đầu và ghi còn bao nhiêu câu nữa; số đếm vẫn đủ")
    void capped() throws Exception {
        StringBuilder sb = new StringBuilder("{\"issues\": [");
        for (int i = 1; i <= 10; i++) {
            sb.append(i > 1 ? "," : "").append("{\"sentence\": \"Satz ").append(i)
                    .append(".\", \"severity\": \"SERIOUS\", \"problemVi\": \"Sai.\"}");
        }
        Check c = ExamDraftService.faithfulResult(issues(sb.append("]}").toString()));
        assertThat(c.count()).isEqualTo(10);
        assertThat(c.detail()).contains("Satz 8.").doesNotContain("Satz 9.").endsWith("… và 2 câu nữa");
    }

    @Test
    @DisplayName("máy chấm nhận tên nguồn, ngày, dữ kiện đã tích và cả dữ kiện cùng nguồn chưa tích")
    void sourcesBlock() {
        Source rki = new Source(1, "https://example.org/a", "RKI", "Schlaf in Deutschland", "A. Beispiel", "2024-03-01",
                "CC BY 4.0", "ADAPT", true, "OK", null, List.of(
                new Fact("f1", "48 Prozent schlafen unter sieben Stunden.", "48 %", "2023", 1, false, true),
                new Fact("f2", "Frauen berichten häufiger von Schlafproblemen.", null, null, 2, false, false)));
        Source bare = new Source(2, null, null, null, null, null, null, "FACTS_ONLY", false, "OK", null, List.of(
                new Fact("g1", "Schichtarbeit hängt mit kürzerem Schlaf zusammen.", null, null, 1, true, true)));

        String block = ExamStudioAi.sourcesBlock(List.of(rki, bare));

        assertThat(block).contains("QUELLE 1: RKI — „Schlaf in Deutschland“, A. Beispiel (2024-03-01)")
                .contains("VERWENDETE FAKTEN:\n- 48 Prozent schlafen unter sieben Stunden. [Zahl: 48 %] [Jahr: 2023]\n")
                .contains("WEITERE FAKTEN DERSELBEN QUELLE:\n- Frauen berichten häufiger von Schlafproblemen.\n")
                .contains("QUELLE 2: (Herausgeber unbekannt)\nVERWENDETE FAKTEN:\n- Schichtarbeit hängt");
        // Nguồn thứ hai không có dữ kiện chưa tích ⇒ không in tiêu đề rỗng.
        assertThat(block.indexOf("WEITERE FAKTEN")).isEqualTo(block.lastIndexOf("WEITERE FAKTEN"));
        assertThat(ExamStudioAi.FAITHFUL_SYSTEM).contains("SERIOUS").contains("MINOR").contains("\"severity\"");
    }

    @Test
    @DisplayName("mục kiểm cũ trong DB (không có count) vẫn đọc được; mục mới ghi kèm count")
    void checkJson() throws Exception {
        Check old = OM.readValue("{\"key\":\"FORMAT\",\"label\":\"x\",\"light\":\"GREEN\",\"detail\":null}", Check.class);
        assertThat(old.count()).isNull();
        Check fresh = OM.readValue(OM.writeValueAsString(new Check("FAITHFUL", "x", "YELLOW", "d", 2)), Check.class);
        assertThat(fresh.count()).isEqualTo(2);
        assertThat(new Check("A", "b", "GREEN", null).count()).isNull();
    }
}
