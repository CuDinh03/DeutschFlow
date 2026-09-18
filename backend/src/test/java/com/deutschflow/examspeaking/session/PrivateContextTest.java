package com.deutschflow.examspeaking.session;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Đề riêng của partner chỉ được đi vào system prompt của AI, không bao giờ ra client
 * (ExamSessionService.clientStimulus lược mọi khoá bắt đầu bằng "partner").
 *
 * Bẫy đã gặp ở Đợt 4: thêm khoá partner* mới trong migration là ĐỦ để ẩn khỏi client, nhưng
 * KHÔNG đủ để AI nhìn thấy — privateContext chỉ đọc đúng những khoá nó biết tên. Khoá nào quên
 * khai báo ở đây thì partner-AI hành xử như không có đề riêng, âm thầm.
 */
class PrivateContextTest {

    @Test
    @DisplayName("partnerStance đi vào ngữ cảnh riêng để partner-AI giữ vai phản biện (B2 Diskussion)")
    void partnerStanceReachesTheAi() {
        String ctx = AiInterlocutorService.privateContext(Map.of(
                "type", "DEBATE_CARD",
                "question", "Sollte die Vier-Tage-Woche kommen?",
                "partnerStance", "dagegen"));

        assertThat(ctx).contains("dagegen");
        assertThat(ctx).contains("Sollte die Vier-Tage-Woche kommen?");
    }

    @Test
    @DisplayName("không có partnerStance thì không bịa ngữ cảnh")
    void noStanceNoContext() {
        assertThat(AiInterlocutorService.privateContext(Map.of("type", "DEBATE_CARD", "question", "X?"))).isEmpty();
        assertThat(AiInterlocutorService.privateContext(null)).isEmpty();
    }

    @Test
    @DisplayName("mọi khoá partner* mà privateContext biết đều phải ra ngữ cảnh — chốt chống quên khai báo")
    void knownPartnerKeysAreAllHandled() {
        assertThat(AiInterlocutorService.privateContext(Map.of("partnerCalendar", "Mo frei", "goal", "Termin")))
                .contains("Mo frei");
        assertThat(AiInterlocutorService.privateContext(Map.of("partnerText", "Umfrage", "thema", "Reisen")))
                .contains("Umfrage");
        assertThat(AiInterlocutorService.privateContext(Map.of("partnerPresentation", "Mein Thema ist …")))
                .contains("Mein Thema ist");
    }

    @Test
    @DisplayName("Đ5b: KNOWN_PARTNER_KEYS (guard admin ngân hàng đề) khớp privateContext — mỗi khoá phải sinh ngữ cảnh")
    void knownPartnerKeysConstantMatchesPrivateContext() {
        // Giá trị đệm cho các khoá phụ (goal/thema/question) mà vài nhánh in kèm.
        Map<String, String> padding = Map.of("goal", "G", "thema", "T", "question", "Q");
        for (String key : AiInterlocutorService.KNOWN_PARTNER_KEYS) {
            java.util.Map<String, Object> card = new java.util.HashMap<>(padding);
            card.put(key, "SENTINEL-" + key);
            assertThat(AiInterlocutorService.privateContext(card))
                    .as("khoá %s nằm trong KNOWN_PARTNER_KEYS nhưng privateContext không đọc nó", key)
                    .isNotEmpty();
        }
    }


    // ── telc B1 dạng 2020 (Gói D, 17/09/2026) ──────────────────────────────────────────────

    @Test
    @DisplayName("partnerOpinion (thẻ ý kiến trái chiều T2) đi vào ngữ cảnh riêng đủ tên/tuổi/nghề/trích dẫn và cho phép đồng tình")
    void partnerOpinionReachesTheAi() {
        String ctx = AiInterlocutorService.privateContext(Map.of(
                "type", "TOPIC_OPINION_PAIR",
                "thema", "Haustiere in der Wohnung",
                "candidateOpinion", Map.of("name", "Sophie Berger", "age", 27, "job", "Verkäuferin", "quote", "Mein Hund macht mich glücklich."),
                "partnerOpinion", Map.of("name", "Markus Weiß", "age", 52, "job", "Steuerberater", "quote", "Tiere in der Stadtwohnung finde ich nicht richtig.")));

        assertThat(ctx).contains("MEINUNGSKARTE").contains("Haustiere in der Wohnung");
        assertThat(ctx).contains("Markus Weiß, 52, Steuerberater").contains("Tiere in der Stadtwohnung");
        assertThat(ctx).as("ý kiến của THÍ SINH không phải đề riêng của partner").doesNotContain("Sophie Berger");
        assertThat(ctx).as("mẹo của người đã thi: bạn thi không ép tranh cãi").containsIgnoringCase("zustimmen");
    }

    @Test
    @DisplayName("partnerExtraQuestions (Zusatzfragen của giám khảo cuối T1) đi vào ngữ cảnh, nói rõ chỉ giám khảo hỏi")
    void partnerExtraQuestionsReachTheAi() {
        String ctx = AiInterlocutorService.privateContext(Map.of(
                "type", "CONTACT_CARD",
                "topics", java.util.List.of("Name", "Sprachen"),
                "partnerExtraQuestions", java.util.List.of("Was machen Sie am Wochenende am liebsten?")));

        assertThat(ctx).contains("ZUSATZFRAGEN").contains("Was machen Sie am Wochenende am liebsten?").contains("Prüfer");
    }
}
