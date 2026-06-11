package com.deutschflow.teacher.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Tests cho phần parse transcription thuần của {@link HandwritingOcrService#parseTranscription}. */
class HandwritingOcrServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    @DisplayName("JSON sạch {\"text\":...} → trích đúng, đã trim")
    void parses_cleanJson() {
        String out = HandwritingOcrService.parseTranscription("{\"text\": \"  Ich heiße Anna.  \"}", mapper);
        assertThat(out).isEqualTo("Ich heiße Anna.");
    }

    @Test
    @DisplayName("bọc code fence ```json ... ``` vẫn trích được")
    void parses_codeFenced() {
        String raw = "```json\n{\"text\": \"Mein Hobby ist Lesen.\"}\n```";
        assertThat(HandwritingOcrService.parseTranscription(raw, mapper)).isEqualTo("Mein Hobby ist Lesen.");
    }

    @Test
    @DisplayName("text rỗng → chuỗi rỗng (ảnh không có chữ)")
    void emptyText() {
        assertThat(HandwritingOcrService.parseTranscription("{\"text\": \"\"}", mapper)).isEmpty();
    }

    @Test
    @DisplayName("null / blank đầu vào → rỗng")
    void nullBlank() {
        assertThat(HandwritingOcrService.parseTranscription(null, mapper)).isEmpty();
        assertThat(HandwritingOcrService.parseTranscription("   ", mapper)).isEmpty();
    }

    @Test
    @DisplayName("có chữ thừa quanh JSON → fallback tách {...}")
    void fallbackExtractObject() {
        String raw = "Hier ist das Ergebnis: {\"text\": \"Guten Tag\"} danke";
        assertThat(HandwritingOcrService.parseTranscription(raw, mapper)).isEqualTo("Guten Tag");
    }

    @Test
    @DisplayName("thiếu field text → rỗng")
    void missingField() {
        assertThat(HandwritingOcrService.parseTranscription("{\"foo\": \"bar\"}", mapper)).isEmpty();
    }
}
