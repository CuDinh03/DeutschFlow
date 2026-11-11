package com.deutschflow.speaking.service;

import com.deutschflow.speaking.entity.AiSpeakingSession;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Prompt chấm cuối phiên dựng bằng {@code String.formatted}. Một dấu % lẻ trong text block làm
 * formatted() ném lỗi; generateReport bắt mọi Exception và trả null, nên báo cáo cuối phiên trống
 * mà không có gì đỏ ngoài một dòng log. Test này dựng prompt thật để lỗi đó không quay lại.
 */
@DisplayName("ConversationEvaluationService — dựng prompt chấm cuối phiên")
class ConversationEvaluationPromptTest {

    private final ConversationEvaluationService service =
            new ConversationEvaluationService(null, null, null, null, null, null);

    @Test
    @DisplayName("prompt dựng được và mang đủ chủ đề, trình độ, hội thoại")
    void promptDungDuoc() {
        AiSpeakingSession session = mock(AiSpeakingSession.class);
        when(session.getTopic()).thenReturn("Mein Tag");
        when(session.getCefrLevel()).thenReturn("A2");

        String prompt = service.buildEvaluationPrompt(session, "LERNENDER: Ich habe viel gelesen.\n");

        assertThat(prompt)
                .contains("Thema: Mein Tag")
                .contains("Ziel-Niveau (CEFR): A2")
                .contains("LERNENDER: Ich habe viel gelesen.")
                .contains("ước lượng % câu đúng ngữ pháp")
                .contains("'khoảng 80%'");
    }

    @Test
    @DisplayName("hội thoại có dấu % không làm hỏng prompt")
    void hoiThoaiCoPhanTram() {
        AiSpeakingSession session = mock(AiSpeakingSession.class);

        String prompt = service.buildEvaluationPrompt(session, "LERNENDER: 100 % sicher, %s und %d.\n");

        assertThat(prompt).contains("100 % sicher, %s und %d.").contains("Thema: Alltag");
    }
}
