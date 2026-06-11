package com.deutschflow.teacher.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AiGradeResultParserTest {

    @Test
    @DisplayName("parses score + feedback from a JSON object (forced json_object mode)")
    void parsesJsonObject() {
        String content = "{\"score\": 85, \"feedback\": \"Ngữ pháp tốt, cần cải thiện từ vựng.\"}";

        assertThat(AiGradeResultParser.parseScore(content)).isEqualTo(85);
        assertThat(AiGradeResultParser.parseFeedback(content))
                .isEqualTo("Ngữ pháp tốt, cần cải thiện từ vựng.");
    }

    @Test
    @DisplayName("parses JSON even when the model wraps it in prose/markdown")
    void parsesJsonWithSurroundingNoise() {
        String content = "Here is the result:\n{\"score\": 72, \"feedback\": \"Khá ổn.\"}\nThanks.";

        // readTree won't parse the whole blob, so this exercises the regex fallback.
        assertThat(AiGradeResultParser.parseScore(content)).isEqualTo(72);
        assertThat(AiGradeResultParser.parseFeedback(content)).isEqualTo("Khá ổn.");
    }

    @Test
    @DisplayName("falls back to legacy SCORE:/FEEDBACK: plain text")
    void parsesLegacyText() {
        String content = "SCORE: 90\nFEEDBACK: Bài viết mạch lạc và rõ ý.";

        assertThat(AiGradeResultParser.parseScore(content)).isEqualTo(90);
        assertThat(AiGradeResultParser.parseFeedback(content)).isEqualTo("Bài viết mạch lạc và rõ ý.");
    }

    @Test
    @DisplayName("clamps out-of-range scores into 0..100")
    void clampsScore() {
        assertThat(AiGradeResultParser.parseScore("{\"score\": 130}")).isEqualTo(100);
        assertThat(AiGradeResultParser.parseScore("{\"score\": -5}")).isEqualTo(0);
    }

    @Test
    @DisplayName("returns null score when no number is present")
    void returnsNullWhenNoScore() {
        assertThat(AiGradeResultParser.parseScore("Tôi không thể chấm bài này.")).isNull();
        assertThat(AiGradeResultParser.parseScore(null)).isNull();
    }

    @Test
    @DisplayName("returns a default feedback string when none is present")
    void returnsDefaultFeedback() {
        assertThat(AiGradeResultParser.parseFeedback("{\"score\": 50}"))
                .isEqualTo(AiGradeResultParser.NO_FEEDBACK);
        assertThat(AiGradeResultParser.parseFeedback(null)).isEqualTo(AiGradeResultParser.NO_FEEDBACK);
    }

    @Test
    @DisplayName("handles a numeric score expressed as a JSON string")
    void parsesStringScore() {
        assertThat(AiGradeResultParser.parseScore("{\"score\": \"88\", \"feedback\": \"OK\"}")).isEqualTo(88);
    }
}
