package com.deutschflow.speaking.interview;

import com.deutschflow.speaking.entity.AiSpeakingMessage;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Đợt C 10/08 — ledger bằng chứng: ghép đúng hỏi/đáp theo lượt + cờ server tính lại deterministic. */
class InterviewEvidenceLedgerTest {

    private static AiSpeakingMessage ai(String text) {
        return AiSpeakingMessage.builder().role(AiSpeakingMessage.MessageRole.ASSISTANT).aiSpeechDe(text).build();
    }

    private static AiSpeakingMessage user(String text) {
        return AiSpeakingMessage.builder().role(AiSpeakingMessage.MessageRole.USER).userText(text).build();
    }

    @Test
    @DisplayName("ghép câu hỏi gần nhất với câu trả lời, đánh số lượt, in nguyên văn")
    void pairsQuestionsWithAnswers() {
        String ledger = InterviewEvidenceLedger.build(List.of(
                ai("Bitte stellen Sie sich kurz vor."),
                user("Ich heiße Minh und arbeite als Entwickler."),
                ai("Welche Projekte haben Sie geleitet?"),
                user("Ich habe eine Zahlungs-API gebaut. Zum Beispiel letztes Jahr haben wir 10000 Nutzer erreicht.")),
                new InterviewAnswerAnalyzer(), "3Y");

        assertThat(ledger).contains("[Lượt 1]").contains("[Lượt 2]");
        assertThat(ledger).contains("FRAGE: \"Bitte stellen Sie sich kurz vor.\"");
        assertThat(ledger).contains("ANTWORT (wörtlich): \"Ich heiße Minh und arbeite als Entwickler.\"");
        assertThat(ledger).contains("FRAGE: \"Welche Projekte haben Sie geleitet?\"");
        assertThat(ledger).contains("SERVER-FAKTEN:");
    }

    @Test
    @DisplayName("phiên không có câu hỏi trước (greeting rỗng) không nổ; lượt vẫn được đánh số")
    void handlesMissingQuestion() {
        String ledger = InterviewEvidenceLedger.build(
                List.of(user("Hallo, ich bin da.")), new InterviewAnswerAnalyzer(), "1-2Y");

        assertThat(ledger).contains("[Lượt 1]").contains("(Gesprächsbeginn)");
    }

    @Test
    @DisplayName("trimUngroundedErrors: server 0 lỗi → common_errors_vi bị ép rỗng; có lỗi → giữ nguyên")
    void trimUngroundedErrors() throws Exception {
        ObjectMapper om = new ObjectMapper();
        InterviewReportValidator validator = new InterviewReportValidator(om);
        String json = """
                {"german_language":{"vocabulary_level":"B1",
                 "common_errors_vi":["Lỗi model tự chế 1","Lỗi model tự chế 2"]}}""";

        String trimmed = validator.trimUngroundedErrors(json, false);
        assertThat(om.readTree(trimmed).get("german_language").get("common_errors_vi")).isEmpty();

        String kept = validator.trimUngroundedErrors(json, true);
        assertThat(om.readTree(kept).get("german_language").get("common_errors_vi")).hasSize(2);
    }
}
