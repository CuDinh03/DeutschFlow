package com.deutschflow.ai.queue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Unit thuần cho bước chuẩn hoá {@code sessionId} của {@code POST /api/jobs/interview-report}. */
@DisplayName("AiJobController.parseSessionId")
class AiJobControllerSessionIdTest {

    @Test
    @DisplayName("nhận số nguyên dương dạng JSON number hoặc chuỗi chữ số")
    void acceptsPositiveIntegers() {
        assertThat(AiJobController.parseSessionId(42)).isEqualTo(42L);
        assertThat(AiJobController.parseSessionId(42L)).isEqualTo(42L);
        assertThat(AiJobController.parseSessionId("42")).isEqualTo(42L);
        assertThat(AiJobController.parseSessionId(" 42 ")).isEqualTo(42L);
    }

    @Test
    @DisplayName("từ chối số thập phân, số không dương, chuỗi không phải số và kiểu khác")
    void rejectsEverythingElse() {
        assertThat(AiJobController.parseSessionId(4.2)).isNull();
        assertThat(AiJobController.parseSessionId(0)).isNull();
        assertThat(AiJobController.parseSessionId(-1)).isNull();
        assertThat(AiJobController.parseSessionId("")).isNull();
        assertThat(AiJobController.parseSessionId("abc")).isNull();
        assertThat(AiJobController.parseSessionId("-5")).isNull();
        assertThat(AiJobController.parseSessionId("1e3")).isNull();
        assertThat(AiJobController.parseSessionId("99999999999999999999")).isNull();
        assertThat(AiJobController.parseSessionId(List.of(1))).isNull();
        assertThat(AiJobController.parseSessionId(true)).isNull();
    }
}
