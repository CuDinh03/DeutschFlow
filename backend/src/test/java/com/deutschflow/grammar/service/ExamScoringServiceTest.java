package com.deutschflow.grammar.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Chấm điểm thi thử: quy về thang của chính đề, đọc đúng khoá bài viết, phần chưa chấm được thì
 * rời khỏi tổng thay vì kéo điểm xuống 0 (gap AC-EXAM-05, sửa 07/09/2026).
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ExamScoringService")
class ExamScoringServiceTest {

    @Mock AiExamEvaluatorService aiEvaluator;
    @InjectMocks ExamScoringService service;

    // ─── Đọc / Nghe ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("đúng 3/4 câu trên thang 25 ra 19 điểm")
    void scoreObjectiveSection_partiallyCorrect_scalesToSectionMax() {
        Map<String, Object> answers = new HashMap<>(Map.of(
                "L1-1", "richtig", "L1-2", "falsch", "L1-3", "richtig", "L1-4", "falsch"));
        Map<String, Object> section = objectiveSection(25, List.of(
                Map.of("id", "L1-1", "correct", "richtig"),
                Map.of("id", "L1-2", "correct", "falsch"),
                Map.of("id", "L1-3", "correct", "richtig"),
                Map.of("id", "L1-4", "correct", "richtig")));

        Map<String, Object> result = service.scoreObjectiveSection(answers, section);

        assertThat(result.get("total")).isEqualTo(19); // 25 × 3/4
        assertThat(result.get("max")).isEqualTo(25);
        assertThat(result.get("correct_items")).isEqualTo(3);
        assertThat(result.get("total_items")).isEqualTo(4);
        assertThat(result.get("status")).isEqualTo(ExamScoringService.STATUS_COMPLETED);
    }

    @Test
    @DisplayName("đề 15 câu làm đúng hết được trọn 25 điểm (trước đây kẹt ở 15)")
    void scoreObjectiveSection_fifteenItemsAllCorrect_returnsFullSectionMax() {
        Map<String, Object> answers = new HashMap<>();
        List<Map<String, Object>> items = new ArrayList<>();
        for (int i = 1; i <= 15; i++) {
            items.add(Map.of("id", "L-" + i, "correct", "A"));
            answers.put("L-" + i, "A");
        }

        Map<String, Object> result = service.scoreObjectiveSection(answers, objectiveSection(25, items));

        assertThat(result.get("total")).isEqualTo(25);
        assertThat(result.get("percentage")).isEqualTo(100);
    }

    @Test
    @DisplayName("tôn trọng max_points riêng của phần")
    void scoreObjectiveSection_customMaxPoints_scalesToThatMax() {
        Map<String, Object> answers = new HashMap<>(Map.of("H-1", "A", "H-2", "B"));
        Map<String, Object> section = objectiveSection(20, List.of(
                Map.of("id", "H-1", "correct", "A"),
                Map.of("id", "H-2", "correct", "B"),
                Map.of("id", "H-3", "correct", "C"),
                Map.of("id", "H-4", "correct", "A")));

        Map<String, Object> result = service.scoreObjectiveSection(answers, section);

        assertThat(result.get("total")).isEqualTo(10); // 20 × 2/4
        assertThat(result.get("max")).isEqualTo(20);
    }

    @Test
    @DisplayName("so khớp không phân biệt hoa thường và khoảng trắng thừa")
    void scoreObjectiveSection_caseAndSpacing_stillMatches() {
        Map<String, Object> answers = new HashMap<>(Map.of("L-1", " RICHTIG ", "L-2", "Falsch"));
        Map<String, Object> section = objectiveSection(25, List.of(
                Map.of("id", "L-1", "correct", "richtig"),
                Map.of("id", "L-2", "correct", "falsch")));

        assertThat(service.scoreObjectiveSection(answers, section).get("total")).isEqualTo(25);
    }

    @Test
    @DisplayName("phần không có câu nào ra 0 điểm, không chia cho 0")
    void scoreObjectiveSection_noItems_returnsZero() {
        Map<String, Object> result = service.scoreObjectiveSection(new HashMap<>(), objectiveSection(25, List.of()));

        assertThat(result.get("total")).isEqualTo(0);
        assertThat(result.get("total_items")).isEqualTo(0);
    }

    @Test
    @DisplayName("teile lưu dạng object map vẫn chấm được")
    void scoreObjectiveSection_teileAsMap_stillScores() {
        Map<String, Object> section = new HashMap<>();
        section.put("max_points", 25);
        section.put("teile", Map.of("1", Map.of("items", List.of(Map.of("id", "L-1", "correct", "A")))));

        Map<String, Object> result = service.scoreObjectiveSection(new HashMap<>(Map.of("L-1", "A")), section);

        assertThat(result.get("total")).isEqualTo(25);
    }

    // ─── Viết ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("bài viết đọc khoá email_<teil> mà trình chạy web gửi lên")
    void scoreSchreibenSection_emailKeyFromRunner_isEvaluated() {
        when(aiEvaluator.evaluateSchreibenEmail(anyLong(), anyString(), anyString(), anyString()))
                .thenReturn(aiScore(12, "AI_EVALUATED"));
        Map<String, Object> answers = new HashMap<>(Map.of(
                "form_0", "Anna", "form_1", "Müller", "form_2", "Hanoi",
                "email_2", "Liebe Anna, ich komme am Montag..."));

        Map<String, Object> result = service.scoreSchreibenSection(7L, answers, schreibenSection(), "A1");

        // form 10 × 3/4 = 7.5 + bài viết 15 × 12/15 = 12 ⇒ 19.5 → 20
        assertThat(result.get("total")).isEqualTo(20);
        assertThat(result.get("max")).isEqualTo(25);
        assertThat(result.get("status")).isEqualTo(ExamScoringService.STATUS_COMPLETED);
        assertThat(result.get("teil2_email")).isNotNull(); // khoá cũ cho màn nhận xét AI
    }

    @Test
    @DisplayName("bỏ trống bài viết là 0 điểm và không gọi AI")
    void scoreSchreibenSection_blankEmail_scoresZeroWithoutAi() {
        Map<String, Object> answers = new HashMap<>(Map.of("form_0", "Anna", "form_1", "Müller"));

        Map<String, Object> result = service.scoreSchreibenSection(7L, answers, schreibenSection(), "A1");

        assertThat(result.get("total")).isEqualTo(5); // 10 × 2/4, bài viết 0
        assertThat(result.get("max")).isEqualTo(25);
        verify(aiEvaluator, never()).evaluateSchreibenEmail(anyLong(), anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("AI chấm hỏng thì nhiệm vụ đó rời khỏi mẫu số, không trừ điểm học viên")
    void scoreSchreibenSection_aiPending_dropsTaskFromMax() {
        when(aiEvaluator.evaluateSchreibenEmail(anyLong(), anyString(), anyString(), anyString()))
                .thenReturn(aiScore(0, ExamScoringService.STATUS_PENDING));
        Map<String, Object> answers = new HashMap<>(Map.of(
                "form_0", "Anna", "form_1", "Müller", "form_2", "Hanoi", "form_3", "1999",
                "email_2", "Liebe Anna, ..."));

        Map<String, Object> result = service.scoreSchreibenSection(7L, answers, schreibenSection(), "A1");

        assertThat(result.get("total")).isEqualTo(10); // form đủ 4/4
        assertThat(result.get("max")).isEqualTo(10);   // 15 điểm bài viết chờ chấm bị loại
        assertThat(result.get("status")).isEqualTo(ExamScoringService.STATUS_COMPLETED);
    }

    @Test
    @DisplayName("đề chỉ có bài viết (B1/B2) chia đều thang điểm cho từng bài")
    void scoreSchreibenSection_writingOnly_splitsMaxEvenly() {
        when(aiEvaluator.evaluateSchreibenEmail(anyLong(), anyString(), anyString(), anyString()))
                .thenReturn(aiScore(15, "AI_EVALUATED"));
        Map<String, Object> section = new HashMap<>();
        section.put("max_points", 25);
        section.put("teile", List.of(
                Map.of("teil", 1, "input_email", "Forumsbeitrag", "instruction_vi", "Viết bài diễn đàn"),
                Map.of("teil", 2, "input_email", "E-Mail", "instruction_vi", "Viết thư")));
        Map<String, Object> answers = new HashMap<>(Map.of("email_1", "Text eins", "email_2", "Text zwei"));

        Map<String, Object> result = service.scoreSchreibenSection(7L, answers, section, "B1");

        assertThat(result.get("total")).isEqualTo(25);
        assertThat(result.get("max")).isEqualTo(25);
    }

    @Test
    @DisplayName("khoá cũ email_section trong dữ liệu lịch sử vẫn chấm được")
    void scoreSchreibenSection_legacyEmailSectionKey_stillEvaluated() {
        when(aiEvaluator.evaluateSchreibenEmail(anyLong(), anyString(), anyString(), anyString()))
                .thenReturn(aiScore(15, "AI_EVALUATED"));
        Map<String, Object> answers = new HashMap<>(Map.of("email_section", "Liebe Anna, ..."));

        Map<String, Object> result = service.scoreSchreibenSection(7L, answers, schreibenSection(), "A1");

        assertThat(result.get("total")).isEqualTo(15); // form trống 0 + bài viết trọn 15
    }

    @Test
    @DisplayName("trình độ của đề được dẫn tới rubric AI, không để mặc định")
    void scoreSchreibenSection_passesExamLevelToEvaluator() {
        when(aiEvaluator.evaluateSchreibenEmail(anyLong(), anyString(), anyString(), anyString()))
                .thenReturn(aiScore(12, "AI_EVALUATED"));
        Map<String, Object> answers = new HashMap<>(Map.of("email_2", "Sehr geehrte Damen und Herren, ..."));

        service.scoreSchreibenSection(7L, answers, schreibenSection(), "C1");

        org.mockito.ArgumentCaptor<String> level = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(aiEvaluator).evaluateSchreibenEmail(anyLong(), anyString(), anyString(), level.capture());
        assertThat(level.getValue()).isEqualTo("C1");
    }

    @Test
    @DisplayName("thiếu trình độ đề thì lấy trường trong phần thi trước khi rơi về mặc định")
    void scoreSprechenSection_fallsBackToSectionLevel() {
        when(aiEvaluator.evaluateSprechen(anyLong(), anyString(), anyString(), anyString()))
                .thenReturn(aiScore(15, "AI_EVALUATED"));
        Map<String, Object> answers = new HashMap<>(Map.of("sprechen_transcript", "Ich heiße Anna..."));

        service.scoreSprechenSection(7L, answers, sprechenSection(), null);

        org.mockito.ArgumentCaptor<String> level = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(aiEvaluator).evaluateSprechen(anyLong(), anyString(), anyString(), level.capture());
        assertThat(level.getValue()).isEqualTo("A1"); // sprechenSection() khai cefr_level = A1
    }

    @Test
    @DisplayName("đề bài gửi cho AI mang cả chủ đề lẫn các ý bắt buộc, không chỉ một dòng tiếng Việt")
    void scoreSchreibenSection_sendsFullTaskAndRequiredPoints() {
        when(aiEvaluator.evaluateSchreibenEmail(anyLong(), anyString(), anyString(), anyString()))
                .thenReturn(aiScore(12, "AI_EVALUATED"));
        Map<String, Object> answers = new HashMap<>(Map.of("email_2", "Hallo Sara, ich wohne jetzt in Berlin."));

        service.scoreSchreibenSection(7L, answers, schreibenSection(), "A1");

        org.mockito.ArgumentCaptor<String> task = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(aiEvaluator).evaluateSchreibenEmail(anyLong(), anyString(), task.capture(), anyString());
        assertThat(task.getValue())
                .as("tiêu chí aufgabenerfuellung cần chủ đề và các ý bắt buộc để đối chiếu")
                .contains("Betreff: Neue Wohnung")
                .contains("Wo du jetzt wohnst")
                .contains("Wann Sara dich besuchen kann")
                .contains("Schreiben Sie eine Antwort"); // câu lệnh tiếng Đức đứng trước bản tiếng Việt
    }

    // ─── Nói ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("không có transcript thì phần Nói là chờ chấm, không phải 0 điểm")
    void scoreSprechenSection_noTranscript_isPending() {
        Map<String, Object> result = service.scoreSprechenSection(7L, new HashMap<>(), sprechenSection(), "A1");

        assertThat(result.get("status")).isEqualTo(ExamScoringService.STATUS_PENDING);
        assertThat(result.get("total")).isEqualTo(0);
        verify(aiEvaluator, never()).evaluateSprechen(anyLong(), anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("có transcript thì quy điểm AI (thang 18) về thang phần")
    void scoreSprechenSection_withTranscript_scalesAiScore() {
        when(aiEvaluator.evaluateSprechen(anyLong(), anyString(), anyString(), anyString()))
                .thenReturn(aiScore(15, "AI_EVALUATED"));
        Map<String, Object> answers = new HashMap<>(Map.of("sprechen_transcript", "Ich heiße Anna..."));

        Map<String, Object> result = service.scoreSprechenSection(7L, answers, sprechenSection(), "A1");

        assertThat(result.get("total")).isEqualTo(21); // 25 × 15/18
        assertThat(result.get("status")).isEqualTo(ExamScoringService.STATUS_COMPLETED);
    }

    // ─── Tổng kết ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("phần chờ chấm rời khỏi cả tử số lẫn mẫu số nên bài vẫn có thể đỗ")
    void summarize_pendingSectionExcluded_examStillPassable() {
        Map<String, Object> detailed = new LinkedHashMap<>();
        detailed.put("LESEN", scored(25, 25));
        detailed.put("HOEREN", scored(20, 25));
        detailed.put("SCHREIBEN", scored(15, 25));
        detailed.put("SPRECHEN", pending(25));

        ExamScoringService.ExamTotals totals = service.summarize(detailed, 60);

        assertThat(totals.rawPoints()).isEqualTo(60);
        assertThat(totals.scoredMax()).isEqualTo(75);
        assertThat(totals.totalScore()).isEqualTo(80); // 60/75 quy về thang 100
        assertThat(totals.passed()).isTrue();
    }

    @Test
    @DisplayName("dưới ngưỡng thì trượt")
    void summarize_belowThreshold_fails() {
        Map<String, Object> detailed = new LinkedHashMap<>();
        detailed.put("LESEN", scored(10, 25));
        detailed.put("HOEREN", scored(10, 25));

        ExamScoringService.ExamTotals totals = service.summarize(detailed, 60);

        assertThat(totals.totalScore()).isEqualTo(40);
        assertThat(totals.passed()).isFalse();
    }

    @Test
    @DisplayName("chưa chấm được phần nào thì 0 điểm và không kết luận đỗ")
    void summarize_allPending_returnsZeroAndNotPassed() {
        Map<String, Object> detailed = new LinkedHashMap<>();
        detailed.put("LESEN", pending(25));
        detailed.put("SPRECHEN", pending(25));

        ExamScoringService.ExamTotals totals = service.summarize(detailed, 60);

        assertThat(totals.totalScore()).isZero();
        assertThat(totals.scoredMax()).isZero();
        assertThat(totals.passed()).isFalse();
    }

    @Test
    @DisplayName("ngưỡng đỗ lấy theo pass_points/total_points của đề")
    void passPercent_readsExamThreshold() {
        assertThat(ExamScoringService.passPercent(60, 100)).isEqualTo(60);
        assertThat(ExamScoringService.passPercent(45, 75)).isEqualTo(60);
        assertThat(ExamScoringService.passPercent(70, 100)).isEqualTo(70);
        assertThat(ExamScoringService.passPercent(null, 100)).isEqualTo(60);
        assertThat(ExamScoringService.passPercent(60, 0)).isEqualTo(60);
    }

    @Test
    @DisplayName("điểm yếu chỉ tính phần đã chấm dưới 60%")
    void identifyWeakAreas_ignoresPendingSections() {
        Map<String, Object> detailed = new LinkedHashMap<>();
        detailed.put("LESEN", scored(20, 25));    // 80%
        detailed.put("HOEREN", scored(12, 25));   // 48%
        detailed.put("SPRECHEN", pending(25));

        List<String> weak = service.identifyWeakAreas(detailed);

        assertThat(weak).containsExactly("HOEREN");
    }

    // ─── Dữ liệu dựng sẵn ────────────────────────────────────────────────────

    private Map<String, Object> objectiveSection(int maxPoints, List<Map<String, Object>> items) {
        Map<String, Object> section = new HashMap<>();
        section.put("max_points", maxPoints);
        section.put("teile", List.of(Map.of("teil", 1, "items", items)));
        return section;
    }

    /** Phần Viết kiểu A1/A2: Teil 1 điền form 4 ô, Teil 2 viết thư. */
    private Map<String, Object> schreibenSection() {
        Map<String, Object> section = new HashMap<>();
        section.put("max_points", 25);
        section.put("teile", List.of(
                Map.of("teil", 1, "type", "FILL_FORM", "form_fields", List.of(
                        Map.of("field", "Vorname"), Map.of("field", "Nachname"),
                        Map.of("field", "Wohnort"), Map.of("field", "Geburtsjahr"))),
                Map.of("teil", 2, "type", "WRITE_EMAIL",
                        "input_email", "Betreff: Neue Wohnung. Wo wohnst du jetzt?",
                        "instruction_de", "Schreiben Sie eine Antwort (circa 30 Wörter).",
                        "instruction_vi", "Viết email ~30 từ",
                        "writing_points", List.of("Wo du jetzt wohnst", "Wann Sara dich besuchen kann"))));
        return section;
    }

    private Map<String, Object> sprechenSection() {
        Map<String, Object> section = new HashMap<>();
        section.put("max_points", 25);
        section.put("cefr_level", "A1");
        section.put("teile", List.of(Map.of("teil", 1, "instruction_vi", "Giới thiệu bản thân")));
        return section;
    }

    private Map<String, Object> aiScore(int total, String status) {
        return Map.of("total", total, "status", status);
    }

    private Map<String, Object> scored(int total, int max) {
        return Map.of("total", total, "max", max, "status", ExamScoringService.STATUS_COMPLETED);
    }

    private Map<String, Object> pending(int max) {
        return Map.of("total", 0, "max", max, "status", ExamScoringService.STATUS_PENDING);
    }
}
