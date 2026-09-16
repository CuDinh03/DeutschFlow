package com.deutschflow.grammar.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cổng Nói của đề telc lấy điểm từ phiên thi nói (module {@code examspeaking}), vì đề giấy telc
 * không có phần Nói — xem §3.4 của kế hoạch.
 *
 * <p><b>Sửa một quyết định của đợt 1 (15/09/2026).</b> Đợt 1 để {@code passed = true} khi cổng Nói
 * còn CHỜ, theo nguyên tắc "chưa chấm được thì đừng đánh trượt". Nguyên tắc đó đúng cho một PHẦN
 * chưa chấm được, nhưng sai cho một CỔNG chưa thi: nó nói với học viên rằng họ đã đỗ telc trong khi
 * họ chưa thi nói, và tệ hơn — {@code /api/certificates/claim} lọc theo đúng cột {@code passed} đó,
 * nên bài viết-một-nửa trở thành một đường lấy chứng nhận. Nay {@code passed} chỉ đúng khi **mọi**
 * cổng đều ĐẠT; sắc thái "chờ" vẫn nói được qua danh sách {@code gates}.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ExamScoringService — cổng Nói của đề telc")
class ExamScoringOralGateTest {

    @Mock AiExamEvaluatorService aiEvaluator;
    @InjectMocks ExamScoringService service;

    private static final Instant THI_NOI_LUC = Instant.parse("2026-09-15T08:30:00Z");

    @Test
    @DisplayName("có phiên thi nói đạt 60/75 thì cổng Nói ĐẠT và kết luận chung là ĐỖ")
    void oralGate_passingSpeakingResult_makesExamPassed() {
        var totals = service.summarize(telcPerfectWritten(), 60, telcPassRule(),
                Map.of("oral", new ExamScoringService.ExternalScore(60, 4242L, THI_NOI_LUC)));

        var oral = gate(totals, "oral");
        assertThat(oral.raw()).isEqualTo(60);
        assertThat(oral.status()).isEqualTo(ExamScoringService.GATE_PASSED);
        assertThat(oral.sourceId()).isEqualTo(4242L);
        assertThat(oral.achievedAt()).isEqualTo(THI_NOI_LUC);
        assertThat(totals.passed()).isTrue();
    }

    @Test
    @DisplayName("44/75 là TRƯỢT phần Nói — giỏi phần viết không bù được")
    void oralGate_belowThreshold_failsWholeExam() {
        var totals = service.summarize(telcPerfectWritten(), 60, telcPassRule(),
                Map.of("oral", new ExamScoringService.ExternalScore(44, 7L, THI_NOI_LUC)));

        assertThat(gate(totals, "written").status()).isEqualTo(ExamScoringService.GATE_PASSED);
        assertThat(gate(totals, "oral").status()).isEqualTo(ExamScoringService.GATE_FAILED);
        assertThat(totals.passed()).isFalse();
    }

    @Test
    @DisplayName("chưa thi nói thì CHƯA ĐỖ — không được nói là đã đỗ telc khi mới thi một nửa")
    void oralGate_noSpeakingSession_isNotPassedYet() {
        var totals = service.summarize(telcPerfectWritten(), 60, telcPassRule(), Map.of());

        assertThat(gate(totals, "written").status()).isEqualTo(ExamScoringService.GATE_PASSED);
        assertThat(gate(totals, "oral").status()).isEqualTo(ExamScoringService.GATE_PENDING);
        assertThat(gate(totals, "oral").sourceId()).isNull();
        assertThat(totals.passed())
                .as("chưa thi nói mà báo ĐỖ thì học viên hiểu sai, và bài này claim được chứng nhận")
                .isFalse();
    }

    @Test
    @DisplayName("trượt phần viết thì dù nói tốt vẫn trượt")
    void oralGate_writtenFailed_stillFails() {
        Map<String, Object> detailed = new LinkedHashMap<>();
        detailed.put("LESEN", scored(40, 75));
        detailed.put("SPRACHBAUSTEINE", scored(15, 30));
        detailed.put("HOEREN", scored(40, 75));
        detailed.put("SCHREIBEN", scored(20, 45));

        var totals = service.summarize(detailed, 60, telcPassRule(),
                Map.of("oral", new ExamScoringService.ExternalScore(75, 9L, THI_NOI_LUC)));

        assertThat(gate(totals, "written").status()).isEqualTo(ExamScoringService.GATE_FAILED);
        assertThat(gate(totals, "oral").status()).isEqualTo(ExamScoringService.GATE_PASSED);
        assertThat(totals.passed()).isFalse();
    }

    @Test
    @DisplayName("HỒI QUY: đề Goethe không có cổng nào vẫn kết luận bằng ngưỡng phần trăm")
    void noGates_goetheUnchanged() {
        Map<String, Object> detailed = new LinkedHashMap<>();
        detailed.put("LESEN", scored(20, 25));
        detailed.put("HOEREN", scored(15, 25));

        var totals = service.summarize(detailed, 60, null, Map.of());

        assertThat(totals.totalScore()).isEqualTo(70);
        assertThat(totals.passed()).isTrue();
        assertThat(totals.gates()).isEmpty();
    }

    @Test
    @DisplayName("điểm ngoài gửi cho một cổng không tồn tại thì bị bỏ qua, không dựng cổng ma")
    void unknownGateId_isIgnored() {
        var totals = service.summarize(telcPerfectWritten(), 60, telcPassRule(),
                Map.of("khong-co-cong-nay", new ExamScoringService.ExternalScore(75, 1L, THI_NOI_LUC)));

        assertThat(totals.gates()).extracting(ExamScoringService.Gate::id)
                .containsExactlyInAnyOrder("written", "oral");
        assertThat(gate(totals, "oral").status()).isEqualTo(ExamScoringService.GATE_PENDING);
    }

    // ─── Dữ liệu dựng sẵn ────────────────────────────────────────────────────

    private Map<String, Object> telcPerfectWritten() {
        Map<String, Object> detailed = new LinkedHashMap<>();
        detailed.put("LESEN", scored(75, 75));
        detailed.put("SPRACHBAUSTEINE", scored(30, 30));
        detailed.put("HOEREN", scored(75, 75));
        detailed.put("SCHREIBEN", scored(45, 45));
        return detailed;
    }

    private Map<String, Object> telcPassRule() {
        return Map.of(
                "written", Map.of("sections", List.of("LESEN", "SPRACHBAUSTEINE", "HOEREN", "SCHREIBEN"),
                        "max", 225, "min", 135),
                "oral", Map.of("source", "SPEAKING_SESSION", "provider", "TELC", "max", 75, "min", 45));
    }

    private ExamScoringService.Gate gate(ExamScoringService.ExamTotals totals, String id) {
        return totals.gates().stream().filter(g -> g.id().equals(id)).findFirst()
                .orElseThrow(() -> new AssertionError("không có cổng '" + id + "'"));
    }

    private Map<String, Object> scored(int total, int max) {
        return Map.of("total", total, "max", max, "status", ExamScoringService.STATUS_COMPLETED);
    }
}
