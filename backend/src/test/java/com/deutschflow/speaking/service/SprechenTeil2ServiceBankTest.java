package com.deutschflow.speaking.service;

import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.examspeaking.entity.SpeakingExamTask;
import com.deutschflow.examspeaking.repository.SpeakingExamTaskRepository;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Mini-game Sprechen Teil 2 (placement) rút thẻ từ NGÂN HÀNG ĐỀ luyện thi (một nguồn đề); rỗng/lỗi → danh sách cứng. */
class SprechenTeil2ServiceBankTest {

    private final SpeakingExamTaskRepository repo = mock(SpeakingExamTaskRepository.class);
    private final SprechenTeil2Service service = new SprechenTeil2Service(
            mock(OpenAiChatClient.class), mock(LlmTierResolver.class), new ObjectMapper(), repo);

    private static SpeakingExamTask task(Map<String, Object> stimulus) {
        return SpeakingExamTask.builder().provider(null).level("A1").teilNo(2).archetype("CARD_QA")
                .stimulusJson(stimulus).status("APPROVED").build();
    }

    @Test
    @DisplayName("ngân hàng có thẻ THEME_CARD → thẻ rút ra từ ngân hàng (thema/wort đúng)")
    void drawsFromBank() {
        when(repo.findApproved("GOETHE", "A1", 2, "CARD_QA")).thenReturn(List.of(
                task(Map.of("type", "THEME_CARD", "thema", "Essen", "wort", "Brot")),
                task(Map.of("type", "THEME_CARD", "thema", "Wohnen", "wort", "Miete")),
                task(Map.of("type", "OTHER"))));
        for (int i = 0; i < 20; i++) {
            SprechenTeil2Service.SprechenCard card = service.getRandomCard();
            assertThat(card.thema()).isIn("Essen", "Wohnen");
            assertThat(card.wort()).isIn("Brot", "Miete");
        }
    }

    @Test
    @DisplayName("ngân hàng rỗng hoặc repository ném lỗi → rơi về danh sách cứng, không bao giờ kẹt")
    void fallsBackToHardcoded() {
        when(repo.findApproved(anyString(), anyString(), anyInt(), anyString())).thenReturn(List.of());
        assertThat(service.getRandomCard().thema()).isNotBlank();

        when(repo.findApproved(anyString(), anyString(), anyInt(), anyString())).thenThrow(new RuntimeException("db down"));
        assertThat(service.bankCards()).isEmpty();
        assertThat(service.getRandomCard().wort()).isNotBlank();
    }
}
