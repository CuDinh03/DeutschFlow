package com.deutschflow.speaking.interview;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Đợt A kế hoạch 10/08 — hàng rào "cấm bịa": trích dẫn phải là lời thật của ứng viên,
 * điểm tổng + verdict do server tính, cap chống thổi phồng từ metrics khách quan.
 */
class InterviewReportValidatorTest {

    private final ObjectMapper om = new ObjectMapper();
    private final InterviewReportValidator validator = new InterviewReportValidator(om);

    /** Lời ứng viên mẫu — mọi trích dẫn hợp lệ phải nằm trong đây. */
    private static final List<String> USER_TEXTS = List.of(
            "Ich arbeite seit drei Jahren als Backend-Entwickler mit Java und Spring Boot.",
            "Unsere Datenbank war langsam. Ich habe die Abfragen analysiert und einen Index hinzugefügt.",
            "Ich möchte mehr über Kubernetes lernen, weil Ihre Firma mit Microservices arbeitet.",
            "Meine Schwäche ist, dass ich manchmal zu viele Details erkläre und den Faden verliere.",
            // Đệm cho corpus vượt ngưỡng 100 từ để cap từ-ít không kích hoạt trong các test PASS.
            "In meinem letzten Projekt habe ich eine Zahlungs-API gebaut, die mehr als zehntausend Nutzer pro Tag"
                    + " bedient hat, und wir haben die Antwortzeit von zwei Sekunden auf zweihundert Millisekunden gesenkt.",
            "Wir arbeiten mit Code-Reviews in kleinen Pull-Requests, schreiben Tests mit JUnit und deployen"
                    + " jede Woche, weil Qualität für unser Team wichtiger ist als reine Geschwindigkeit im Sprint.");

    private static String cat(String name, double score, String quote) {
        return """
                {"name_vi":"%s","score":%s,
                 "green_flags_vi":["Ứng viên nói „%s“ — rất cụ thể"],
                 "red_flags_vi":[],"comment_vi":"Nhận xét."}""".formatted(name, score, quote);
    }

    private static String report(String c1, String c2, String c3, String c4) {
        return """
                {"overall_score":"9.9/10","verdict":"PASS","verdict_label_vi":"Đạt",
                 "categories":[%s,%s,%s,%s],
                 "german_language":{"vocabulary_level":"B1","fluency_vi":"ổn","common_errors_vi":[]},
                 "remediation_vi":["a","b","c"],"encouragement_vi":"Tốt."}""".formatted(c1, c2, c3, c4);
    }

    private static String validReport(double s1, double s2, double s3, double s4) {
        return report(
                cat("Cấu trúc & Sự cô đọng (Struktur & Prägnanz)", s1, "Ich arbeite seit drei Jahren als Backend-Entwickler"),
                cat("Kỹ năng chuyên môn (Fachkompetenz)", s2, "Ich habe die Abfragen analysiert und einen Index hinzugefügt"),
                cat("Kỹ năng giao tiếp & Năng lượng (Kommunikation & Energie)", s3, "Ich möchte mehr über Kubernetes lernen"),
                cat("Động lực & Định hướng (Motivation & Ausrichtung)", s4, "weil Ihre Firma mit Microservices arbeitet"));
    }

    private static InterviewSessionState stateWithConcreteExample() {
        InterviewSessionState state = InterviewSessionState.initial(1, "focus");
        state.applyAfterTurn(
                new InterviewTurnPlan(1, InterviewPhase.HARD_SKILLS, InterviewDirectiveType.STANDARD,
                        "", "q", "id1", "topic", 15, List.of(), null, false),
                new InterviewAnswerAnalysis(false, false, false, false, false, true, false));
        return state;
    }

    @Test
    @DisplayName("report hợp lệ: quote thật → valid; overall + verdict do server tính lại")
    void validReport_serverRecomputesOverallAndVerdict() throws Exception {
        var vr = validator.validate(validReport(8, 8, 7, 8), USER_TEXTS, stateWithConcreteExample());

        assertThat(vr.valid()).isTrue();
        JsonNode out = om.readTree(vr.normalizedJson());
        // mean(8,8,7,8)=7.75 → làm tròn 0.5 → 8 → PASS (model đòi 9.9 bị ghi đè)
        assertThat(out.get("overall_score").asText()).isEqualTo("8/10");
        assertThat(out.get("verdict").asText()).isEqualTo("PASS");
        assertThat(out.get("verdict_label_vi").asText()).isEqualTo("Đạt");
    }

    @Test
    @DisplayName("ngưỡng verdict: 5.0 → CONDITIONAL_PASS, dưới 5 → NOT_PASS")
    void verdictThresholds() throws Exception {
        var conditional = validator.validate(validReport(5, 5, 5, 5), USER_TEXTS, stateWithConcreteExample());
        assertThat(om.readTree(conditional.normalizedJson()).get("verdict").asText()).isEqualTo("CONDITIONAL_PASS");

        var notPass = validator.validate(validReport(4, 4, 5, 5), USER_TEXTS, stateWithConcreteExample());
        assertThat(om.readTree(notPass.normalizedJson()).get("verdict").asText()).isEqualTo("NOT_PASS");
        assertThat(om.readTree(notPass.normalizedJson()).get("verdict_label_vi").asText()).isEqualTo("Chưa đạt");
    }

    @Test
    @DisplayName("trích dẫn BỊA (không có trong lời ứng viên) → invalid")
    void fabricatedQuote_fails() {
        String fabricated = report(
                cat("Cấu trúc & Sự cô đọng (Struktur & Prägnanz)", 8, "Ich bin ein sehr strukturierter Mensch mit klaren Zielen"),
                cat("Kỹ năng chuyên môn (Fachkompetenz)", 8, "Ich habe die Abfragen analysiert und einen Index hinzugefügt"),
                cat("Kỹ năng giao tiếp & Năng lượng (Kommunikation & Energie)", 7, "Ich möchte mehr über Kubernetes lernen"),
                cat("Động lực & Định hướng (Motivation & Ausrichtung)", 8, "weil Ihre Firma mit Microservices arbeitet"));

        var vr = validator.validate(fabricated, USER_TEXTS, stateWithConcreteExample());

        assertThat(vr.valid()).isFalse();
        assertThat(String.join(" ", vr.failures())).contains("Cấu trúc");
    }

    @Test
    @DisplayName("so khớp trích dẫn bỏ qua hoa/thường và dấu câu")
    void quoteMatching_normalizesCaseAndPunctuation() {
        String withPunctDiff = report(
                cat("Cấu trúc & Sự cô đọng (Struktur & Prägnanz)", 7, "ich arbeite seit drei jahren als backend entwickler"),
                cat("Kỹ năng chuyên môn (Fachkompetenz)", 7, "Ich habe die Abfragen analysiert und einen Index hinzugefügt"),
                cat("Kỹ năng giao tiếp & Năng lượng (Kommunikation & Energie)", 7, "Ich möchte mehr über Kubernetes lernen"),
                cat("Động lực & Định hướng (Motivation & Ausrichtung)", 7, "weil Ihre Firma mit Microservices arbeitet"));

        assertThat(validator.validate(withPunctDiff, USER_TEXTS, stateWithConcreteExample()).valid()).isTrue();
    }

    @Test
    @DisplayName("JSON cụt / thiếu category / score ngoài 0-10 → invalid")
    void structuralFailures() {
        assertThat(validator.validate(validReport(7, 7, 7, 7).substring(0, 200), USER_TEXTS, null).valid()).isFalse();
        assertThat(validator.validate("hoàn toàn không phải json", USER_TEXTS, null).valid()).isFalse();
        assertThat(validator.validate(null, USER_TEXTS, null).valid()).isFalse();

        String threeCats = """
                {"categories":[%s,%s,%s]}""".formatted(
                cat("A", 7, "Ich arbeite seit drei Jahren"), cat("B", 7, "x"), cat("C", 7, "y"));
        assertThat(validator.validate(threeCats, USER_TEXTS, null).valid()).isFalse();

        String badScore = validReport(7, 7, 7, 7).replace("\"score\":7.0", "\"score\":15")
                .replace("\"score\":7,", "\"score\":15,");
        assertThat(validator.validate(badScore, USER_TEXTS, null).valid()).isFalse();
    }

    @Test
    @DisplayName("cap chống thổi phồng: không có ví dụ cụ thể → Fachkompetenz ≤ 5, overall tính trên điểm đã cap")
    void capsWithoutConcreteExample() throws Exception {
        InterviewSessionState noExample = InterviewSessionState.initial(1, "focus");

        // Cần >100 từ user để không dính cap từ-ít — nhân bản corpus.
        List<String> longTexts = List.of(
                String.join(" ", USER_TEXTS), String.join(" ", USER_TEXTS),
                String.join(" ", USER_TEXTS), String.join(" ", USER_TEXTS));
        var vr = validator.validate(validReport(9, 9, 9, 9), longTexts, noExample);

        assertThat(vr.valid()).isTrue();
        JsonNode cats = om.readTree(vr.normalizedJson()).get("categories");
        assertThat(cats.get(1).get("score").asDouble()).isEqualTo(5.0);   // Fachkompetenz capped
        assertThat(cats.get(0).get("score").asDouble()).isEqualTo(9.0);   // còn lại giữ nguyên
        // mean(9,5,9,9)=8.0 → PASS vẫn có thể xảy ra, nhưng overall phải phản ánh điểm ĐÃ cap
        assertThat(om.readTree(vr.normalizedJson()).get("overall_score").asText()).isEqualTo("8/10");
    }

    @Test
    @DisplayName("ứng viên nói < 100 từ → mọi category cap 6")
    void capsLowWordCount() throws Exception {
        List<String> shortTexts = List.of(
                "Ich arbeite seit drei Jahren als Backend-Entwickler mit Java und Spring Boot.",
                "Ich möchte mehr über Kubernetes lernen, weil Ihre Firma mit Microservices arbeitet.");
        String rpt = report(
                cat("Cấu trúc & Sự cô đọng (Struktur & Prägnanz)", 9, "Ich arbeite seit drei Jahren als Backend-Entwickler"),
                cat("Kỹ năng chuyên môn (Fachkompetenz)", 9, "mit Java und Spring Boot"),
                cat("Kỹ năng giao tiếp & Năng lượng (Kommunikation & Energie)", 9, "Ich möchte mehr über Kubernetes lernen"),
                cat("Động lực & Định hướng (Motivation & Ausrichtung)", 9, "weil Ihre Firma mit Microservices arbeitet"));

        var vr = validator.validate(rpt, shortTexts, stateWithConcreteExample());

        assertThat(vr.valid()).isTrue();
        JsonNode cats = om.readTree(vr.normalizedJson()).get("categories");
        for (int i = 0; i < 4; i++) {
            assertThat(cats.get(i).get("score").asDouble()).isLessThanOrEqualTo(6.0);
        }
    }

    @Test
    @DisplayName("INSUFFICIENT_DATA và EVAL_FAILED: đúng type; chỉ EVAL_FAILED là retryable")
    void statusBuildersAndRetryability() {
        String insufficient = validator.insufficientData(1, 12, 2, 30);
        String failed = validator.evalFailed(List.of("lý do"));

        assertThat(insufficient).contains("\"type\":\"INSUFFICIENT_DATA\"").contains("\"user_turns\":1");
        assertThat(failed).contains("\"type\":\"EVAL_FAILED\"");
        assertThat(InterviewReportValidator.isRetryableFailure(failed)).isTrue();
        assertThat(InterviewReportValidator.isRetryableFailure(insufficient)).isFalse();
        assertThat(InterviewReportValidator.isRetryableFailure("{\"overall_score\":\"7/10\"}")).isFalse();
        assertThat(InterviewReportValidator.isRetryableFailure(null)).isFalse();
    }

    @Test
    @DisplayName("countWords đếm sau chuẩn hoá")
    void countWords() {
        assertThat(InterviewReportValidator.countWords(List.of("Hallo, ich heiße Tuan!", "", "Ja."))).isEqualTo(5);
    }
}
