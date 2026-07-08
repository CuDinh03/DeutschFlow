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

    @Test
    @DisplayName("parses confidence (clamped) and returns null when absent")
    void parsesConfidence() {
        assertThat(AiGradeResultParser.parseConfidence("{\"score\":80,\"confidence\":92}")).isEqualTo(92);
        assertThat(AiGradeResultParser.parseConfidence("{\"score\":80,\"confidence\":150}")).isEqualTo(100);
        assertThat(AiGradeResultParser.parseConfidence("{\"score\":80}")).isNull();
        assertThat(AiGradeResultParser.parseConfidence(null)).isNull();
    }

    @Test
    @DisplayName("parses criteria map (clamped) and drops non-numeric entries")
    void parsesCriteria() {
        String content = "{\"score\":80,\"criteria\":{\"grammar\":85,\"vocabulary\":\"70\",\"content\":120,\"structure\":\"n/a\"}}";

        var criteria = AiGradeResultParser.parseCriteria(content);

        assertThat(criteria).containsEntry("grammar", 85).containsEntry("vocabulary", 70).containsEntry("content", 100);
        assertThat(criteria).doesNotContainKey("structure");
    }

    @Test
    @DisplayName("returns null criteria when absent or empty")
    void returnsNullCriteria() {
        assertThat(AiGradeResultParser.parseCriteria("{\"score\":80}")).isNull();
        assertThat(AiGradeResultParser.parseCriteria("{\"score\":80,\"criteria\":{}}")).isNull();
        assertThat(AiGradeResultParser.parseCriteria(null)).isNull();
    }

    @Test
    @DisplayName("D4a: KHÔNG bịa điểm từ số trong feedback khi JSON object không có 'score'")
    void doesNotFabricateScoreFromFeedbackProse() {
        // Valid JSON object whose feedback mentions "score: 95" but there is NO top-level score key.
        String content = "{\"feedback\":\"Your score: 95 is only an estimate.\"}";
        assertThat(AiGradeResultParser.parseScore(content)).isNull();
    }

    @Test
    @DisplayName("D4b: điểm dạng tỉ lệ ('7/10', '8 von 10', '9 of 10') được quy về thang 100")
    void rescalesRatioScore() {
        assertThat(AiGradeResultParser.parseScore("{\"score\":\"7/10\"}")).isEqualTo(70);
        assertThat(AiGradeResultParser.parseScore("{\"score\":\"8 von 10\"}")).isEqualTo(80);
        assertThat(AiGradeResultParser.parseScore("{\"score\":\"9 of 10\"}")).isEqualTo(90);
    }

    @Test
    @DisplayName("D4c: chọn object chứa 'score', bỏ qua số 'score: 40' trong prose giữa nhiều JSON")
    void prefersJsonScoreObjectOverProseNumber() {
        String content = "{\"aspect\":\"grammar\"} — score: 40 trên thang nháp, chốt: "
                + "{\"score\":88,\"feedback\":\"tốt\"}";
        assertThat(AiGradeResultParser.parseScore(content)).isEqualTo(88);
        assertThat(AiGradeResultParser.parseFeedback(content)).isEqualTo("tốt");
    }
}
