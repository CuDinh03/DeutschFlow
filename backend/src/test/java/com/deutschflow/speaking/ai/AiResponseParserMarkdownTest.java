package com.deutschflow.speaking.ai;

import com.deutschflow.speaking.contract.SpeakingResponseSchema;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Chốt chặn QA prod 09/08 mục C: model trả {@code **A**} nhưng UI render text thuần
 * → dấu sao lộ nguyên văn ra bong bóng chat và bị TTS đọc thành tiếng. Prompt đã cấm
 * markdown; đây là lưới an toàn phía server (web + mobile cùng hưởng).
 */
class AiResponseParserMarkdownTest {

    private AiResponseParser parser;

    @BeforeEach
    void setUp() {
        parser = new AiResponseParser(new ObjectMapper());
    }

    @Test
    void v1_goBoldKhoiMoiTruongHienThi() {
        String json = """
                {
                  "ai_speech_de": "Hãy nhớ **A** (a), **B** (bê) nhé!",
                  "feedback": "Bạn làm **rất tốt**!",
                  "correction": "Ich trinke **den** Kaffee.",
                  "explanation_vi": "Kaffee giống đực nên dùng *den*."
                }
                """;
        var dto = parser.parseWithOutcome(json).dto();
        assertThat(dto.aiSpeechDe()).isEqualTo("Hãy nhớ A (a), B (bê) nhé!");
        assertThat(dto.feedback()).isEqualTo("Bạn làm rất tốt!");
        assertThat(dto.correction()).isEqualTo("Ich trinke den Kaffee.");
        assertThat(dto.explanationVi()).isEqualTo("Kaffee giống đực nên dùng den.");
    }

    @Test
    void v2_goMarkdownKhoiContentVaTranslation() {
        String json = """
                {
                  "content": "Heute lernen wir das **Alphabet**.",
                  "translation": "Hôm nay học **bảng chữ cái**.",
                  "feedback": null,
                  "action": "Đọc to chữ `A` nhé"
                }
                """;
        var dto = parser.parseWithOutcome(json, SpeakingResponseSchema.V2).dto();
        assertThat(dto.aiSpeechDe()).isEqualTo("Heute lernen wir das Alphabet.");
        assertThat(dto.explanationVi()).isEqualTo("Hôm nay học bảng chữ cái.");
        assertThat(dto.action()).isEqualTo("Đọc to chữ A nhé");
    }

    @Test
    void fallback_textThuanCoMarkdown_cungDuocGo() {
        var dto = parser.parseWithOutcome("Hallo! Heute: **das Alphabet**!").dto();
        assertThat(dto.aiSpeechDe()).isEqualTo("Hallo! Heute: das Alphabet!");
    }

    @Test
    void stripInlineMarkdown_giuDauSaoLe_vaTextThuong() {
        assertThat(AiResponseParser.stripInlineMarkdown("2 * 3 = 6")).isEqualTo("2 * 3 = 6");
        assertThat(AiResponseParser.stripInlineMarkdown("*nhấn mạnh*")).isEqualTo("nhấn mạnh");
        assertThat(AiResponseParser.stripInlineMarkdown("# Tiêu đề\nNội dung")).isEqualTo("Tiêu đề\nNội dung");
        assertThat(AiResponseParser.stripInlineMarkdown(null)).isNull();
    }
}
