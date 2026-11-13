package com.deutschflow.examstudio;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Xưởng đề — model hết chỗ phía nhà cung cấp: nhận diện, thời gian chờ, danh sách bản thay thế")
class ExamStudioAiCapacityTest {

    /** Nguyên văn 9Router trả ngày 13/11/2026 (rút gọn). */
    private static final String BODY = "{\"error\":{\"message\":\"[antigravity/gemini-3.8-flash-high] [503]: {\\n \\\"error\\\": {"
            + "\\\"code\\\": 503, \\\"message\\\": \\\"No capacity available for model gemini-3.8-flash-high on the server\\\","
            + " \\\"status\\\": \\\"UNAVAILABLE\\\", \\\"reason\\\": \\\"MODEL_CAPACITY_EXHAUSTED\\\" (reset after 32s)\"}}";

    @Test
    @DisplayName("503/429 kèm chữ hết chỗ ⇒ lỗi hết chỗ; 503 trơn, 500, 404 thì không")
    void recognises() {
        assertThat(ExamStudioAi.isCapacityError(503, BODY)).isTrue();
        assertThat(ExamStudioAi.isCapacityError(429, "{\"error\":\"model overloaded\"}")).isTrue();
        assertThat(ExamStudioAi.isCapacityError(503, "{\"error\":\"bad gateway\"}")).isFalse();
        assertThat(ExamStudioAi.isCapacityError(503, null)).isFalse();
        assertThat(ExamStudioAi.isCapacityError(500, BODY)).isFalse();
        assertThat(ExamStudioAi.isCapacityError(404, BODY)).isFalse();
    }

    @Test
    @DisplayName("thời gian chờ đọc từ \"reset after\"; không nói ⇒ 30 giây; không quá 90 giây")
    void waitTime() {
        assertThat(ExamStudioAi.resetSeconds(BODY)).isEqualTo(32);
        assertThat(ExamStudioAi.resetSeconds("x (reset after 47s)")).isEqualTo(47);
        assertThat(ExamStudioAi.resetSeconds("x (reset after 2m)")).isEqualTo(90);
        assertThat(ExamStudioAi.resetSeconds("x (reset after 1m 10s)")).isEqualTo(70);
        assertThat(ExamStudioAi.resetSeconds("No capacity available")).isEqualTo(30);
        assertThat(ExamStudioAi.resetSeconds(null)).isEqualTo(30);
    }

    @Test
    @DisplayName("chỉ model có trong danh sách mới được thay, bằng các bản đứng SAU nó")
    void chain() {
        String csv = "ag/gemini-3.8-flash-high, ag/gemini-3.8-flash-medium,ag/gemini-4-argon-medium";
        assertThat(ExamStudioAi.fallbackChain("ag/gemini-3.8-flash-high", csv))
                .containsExactly("ag/gemini-3.8-flash-medium", "ag/gemini-4-argon-medium");
        assertThat(ExamStudioAi.fallbackChain("ag/gemini-3.8-flash-medium", csv)).containsExactly("ag/gemini-4-argon-medium");
        assertThat(ExamStudioAi.fallbackChain("ag/gemini-4-argon-medium", csv)).isEmpty();
        // Claude viết bài không nằm trong danh sách ⇒ không bao giờ bị thay bằng Gemini.
        assertThat(ExamStudioAi.fallbackChain("cc/claude-opus-5-5", csv)).isEmpty();
        assertThat(ExamStudioAi.fallbackChain("ag/gemini-3.8-flash-high", "")).isEmpty();
        assertThat(ExamStudioAi.fallbackChain("ag/gemini-3.8-flash-high", null)).isEmpty();
    }
}
