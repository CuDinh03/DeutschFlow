package com.deutschflow.speaking.service;

import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.entity.AiSpeakingMessage;
import com.deutschflow.speaking.entity.AiSpeakingMessage.MessageRole;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Đ2 — thứ tự message quyết định prefix-cache: [system TĨNH][history…][system ĐỘNG?][user].
 * Khối động mà chen lên TRƯỚC history là prefix chung giữa các lượt đứt ngay sau system prompt;
 * đứng SAU history thì prefix chung = tĩnh + toàn bộ history cũ (append-only trong cửa sổ).
 */
class ChatPrepMessageAssemblyTest {

    private static AiSpeakingMessage userMsg(String text) {
        return AiSpeakingMessage.builder().role(MessageRole.USER).userText(text).build();
    }

    private static AiSpeakingMessage aiMsg(String text) {
        return AiSpeakingMessage.builder().role(MessageRole.ASSISTANT).aiSpeechDe(text).build();
    }

    @Test
    @DisplayName("có khối động: [system tĩnh][history][system động][user] — động đứng SAU history")
    void dynamicContextSitsAfterHistoryBeforeUser() {
        List<ChatMessage> messages = ChatPrepService.buildOpenAiMessages(
                "STATIC", List.of(userMsg("Hallo"), aiMsg("Hallo! Wie geht's?")), "DYNAMIC", "Gut, danke");

        assertThat(messages).extracting(ChatMessage::role)
                .containsExactly("system", "user", "assistant", "system", "user");
        assertThat(messages.get(0).content()).isEqualTo("STATIC");
        assertThat(messages.get(3).content()).isEqualTo("DYNAMIC");
        assertThat(messages.get(4).content()).isEqualTo("Gut, danke");
    }

    @Test
    @DisplayName("không có khối động (null/blank): giữ nguyên hình dạng cũ, không message rỗng")
    void noDynamicContextKeepsLegacyShape() {
        List<ChatMessage> withNull = ChatPrepService.buildOpenAiMessages(
                "STATIC", List.of(userMsg("Hallo")), null, "Wie bitte?");
        List<ChatMessage> withBlank = ChatPrepService.buildOpenAiMessages(
                "STATIC", List.of(userMsg("Hallo")), "  ", "Wie bitte?");

        assertThat(withNull).extracting(ChatMessage::role).containsExactly("system", "user", "user");
        assertThat(withBlank).extracting(ChatMessage::role).containsExactly("system", "user", "user");
    }
}
