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
}
