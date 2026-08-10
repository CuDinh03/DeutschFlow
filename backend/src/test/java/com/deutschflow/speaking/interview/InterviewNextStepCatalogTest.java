package com.deutschflow.speaking.interview;

import com.deutschflow.speaking.entity.AiSpeakingMessage;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** Đợt D 10/08 — next_steps từ danh mục tĩnh: điều kiện khách quan + server lọc mã bịa/không thoả. */
class InterviewNextStepCatalogTest {

    private final ObjectMapper om = new ObjectMapper();
    private final InterviewReportValidator validator = new InterviewReportValidator(om);

    private static AiSpeakingMessage user(String text) {
        return AiSpeakingMessage.builder().role(AiSpeakingMessage.MessageRole.USER).userText(text).build();
    }

    @Test
    @DisplayName("allowedFor: không ví dụ cụ thể → PRACTICE_STAR; có lỗi → DRILL_ERRORS; câu ngắn → EXPAND_ANSWERS")
    void allowedForConditions() {
        InterviewSessionState noExample = InterviewSessionState.initial(1, "f");
        List<AiSpeakingMessage> shortAnswers = List.of(user("Ich weiß nicht."), user("Vielleicht gut."));

        Set<String> allowed = InterviewNextStepCatalog.allowedFor(noExample, 3, shortAnswers);

        assertThat(allowed).contains(
                InterviewNextStepCatalog.RETRY_SAME_POSITION,
                InterviewNextStepCatalog.PRACTICE_STAR,
                InterviewNextStepCatalog.DRILL_ERRORS,
                InterviewNextStepCatalog.EXPAND_ANSWERS,
                InterviewNextStepCatalog.FACH_VOCAB);
    }

    @Test
    @DisplayName("allowedFor: 0 lỗi ghi nhận → KHÔNG có DRILL_ERRORS; câu dài → KHÔNG có EXPAND_ANSWERS")
    void allowedForExcludesUnmetConditions() {
        List<AiSpeakingMessage> longAnswers = List.of(
                user("In meiner letzten Stelle habe ich jeden Monat ungefähr dreihundert Rechnungen verwaltet und ein neues Excel System aufgebaut, damit haben wir zwanzig Prozent Zeit gespart."));

        Set<String> allowed = InterviewNextStepCatalog.allowedFor(null, 0, longAnswers);

        assertThat(allowed).doesNotContain(InterviewNextStepCatalog.DRILL_ERRORS,
                InterviewNextStepCatalog.EXPAND_ANSWERS);
        assertThat(allowed).contains(InterviewNextStepCatalog.RETRY_SAME_POSITION);
    }

    @Test
    @DisplayName("sanitizeNextSteps: mã bịa/mã ngoài tập cho phép bị loại, giữ tối đa 3 mã hợp lệ")
    void sanitizeDropsUnknownAndDisallowedCodes() throws Exception {
        String json = """
                {"next_steps":[
                  {"code":"RETRY_SAME_POSITION","reason_vi":"a"},
                  {"code":"BUY_PREMIUM_COURSE","reason_vi":"mã model tự chế"},
                  {"code":"DRILL_ERRORS","reason_vi":"không được phép vì phiên 0 lỗi"},
                  {"code":"FACH_VOCAB","reason_vi":"b"}]}""";

        String out = validator.sanitizeNextSteps(json,
                Set.of(InterviewNextStepCatalog.RETRY_SAME_POSITION, InterviewNextStepCatalog.FACH_VOCAB),
                List.of("Ich arbeite im Büro."));

        var steps = om.readTree(out).get("next_steps");
        assertThat(steps).hasSize(2);
        assertThat(steps.get(0).get("code").asText()).isEqualTo("RETRY_SAME_POSITION");
        assertThat(steps.get(1).get("code").asText()).isEqualTo("FACH_VOCAB");
    }

    @Test
    @DisplayName("answer_upgrades: câu gốc BỊA (ứng viên chưa từng nói) bị loại; câu thật được giữ")
    void sanitizeDropsFabricatedOriginalQuotes() throws Exception {
        String json = """
                {"answer_upgrades":[
                  {"original_quote":"Ich bin sehr dynamisch und zielstrebig","better_de":"x"},
                  {"original_quote":"Ich weiß nicht. Vielleicht Restaurant ist gut.","better_de":"Ich interessiere mich für die Arbeit im Restaurant, weil ich gern mit Menschen arbeite."}]}""";

        String out = validator.sanitizeNextSteps(json, Set.of(),
                List.of("Ich weiß nicht. Vielleicht Restaurant ist gut.", "Ich trage Teller."));

        var ups = om.readTree(out).get("answer_upgrades");
        assertThat(ups).hasSize(1);
        assertThat(ups.get(0).get("original_quote").asText()).contains("Restaurant ist gut");
    }
}
