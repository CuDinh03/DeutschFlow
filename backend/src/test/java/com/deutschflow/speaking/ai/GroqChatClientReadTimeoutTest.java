package com.deutschflow.speaking.ai;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("GroqChatClient — thời gian chờ lượt không stream chỉnh được theo nguồn AI")
class GroqChatClientReadTimeoutTest {

    @Test
    @DisplayName("không đặt biến hoặc đặt sai ⇒ giữ 15 giây; giá trị hợp lệ 5–120 giây được nhận")
    void readTimeoutFromEnv() {
        assertThat(GroqChatClient.readTimeoutFromEnv(null)).isEqualTo(15_000);
        assertThat(GroqChatClient.readTimeoutFromEnv(" ")).isEqualTo(15_000);
        assertThat(GroqChatClient.readTimeoutFromEnv("abc")).isEqualTo(15_000);
        assertThat(GroqChatClient.readTimeoutFromEnv("1000")).isEqualTo(15_000);     // quá ngắn
        assertThat(GroqChatClient.readTimeoutFromEnv("600000")).isEqualTo(15_000);   // quá dài: giữ luồng xử lý quá lâu
        assertThat(GroqChatClient.readTimeoutFromEnv(" 60000 ")).isEqualTo(60_000);
        assertThat(GroqChatClient.readTimeoutFromEnv("5000")).isEqualTo(5_000);
    }

    @Test
    @DisplayName("trần tổng của cả lượt luôn dài hơn thời gian chờ một lần gọi")
    void deadlineCoversTimeout() {
        assertThat(GroqChatClient.REQUEST_DEADLINE_MILLIS).isGreaterThanOrEqualTo(20_000L)
                .isGreaterThan(GroqChatClient.READ_TIMEOUT_MILLIS);
    }
}
