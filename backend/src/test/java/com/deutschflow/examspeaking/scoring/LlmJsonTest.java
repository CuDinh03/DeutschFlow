package com.deutschflow.examspeaking.scoring;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LlmJsonTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void stripsFencesAndUnwrapsTypeContentWrapper() {
        String fenced = "```json\n{\"score\": 7}\n```";
        assertThat(LlmJson.parse(mapper, fenced).orElseThrow().path("score").asInt()).isEqualTo(7);

        String wrapped = "{\"type\":\"json\",\"content\":\"{\\\"score\\\": 8}\"}";
        assertThat(LlmJson.parse(mapper, wrapped).orElseThrow().path("score").asInt()).isEqualTo(8);

        String wrappedObject = "Hier: {\"type\":\"object\",\"content\":{\"score\":9}} Ende";
        assertThat(LlmJson.parse(mapper, wrappedObject).orElseThrow().path("score").asInt()).isEqualTo(9);

        assertThat(LlmJson.parse(mapper, "kein json")).isEmpty();
    }

    @Test
    void speechTextStripsLiteralEscapeSequencesFromDoubleEscapedLlmOutput() throws Exception {
        // Ca THẬT trên prod 26/08: LLM double-escape ⇒ Jackson decode ra hai ký tự `\` + `n`,
        // chuỗi "\n" lòi nguyên văn ra bong bóng chat và TTS đọc thành "backslash en".
        String raw = "{\"reply_de\": \"Ich gehe gern mit Freunden zusammen.\\\\n Wie oft kochst du?\"}";
        JsonNode node = LlmJson.parse(mapper, raw).orElseThrow();
        assertThat(node.path("reply_de").asText()).contains("\\n"); // vẫn bẩn khi đọc thô

        assertThat(LlmJson.speechText(node, "reply_de"))
                .isEqualTo("Ich gehe gern mit Freunden zusammen. Wie oft kochst du?");
    }

    @Test
    void normalizeSpeechCollapsesRealNewlinesAndKeepsNormalTextIntact() {
        assertThat(LlmJson.normalizeSpeech("Zeile eins\nZeile zwei")).isEqualTo("Zeile eins Zeile zwei");
        assertThat(LlmJson.normalizeSpeech("  viel   Abstand  ")).isEqualTo("viel Abstand");
        assertThat(LlmJson.normalizeSpeech(null)).isEmpty();
        assertThat(LlmJson.normalizeSpeech("")).isEmpty();
        // Không đụng tới câu bình thường (kể cả dấu tiếng Đức).
        assertThat(LlmJson.normalizeSpeech("Ich möchte größere Brötchen, weil's schmeckt!"))
                .isEqualTo("Ich möchte größere Brötchen, weil's schmeckt!");
    }
}
