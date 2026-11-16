package com.deutschflow.ai.trace;

import ch.qos.logback.classic.Level;
import com.deutschflow.speaking.exception.AiErrorCode;
import com.deutschflow.speaking.exception.AiServiceException;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;

import java.net.SocketTimeoutException;
import java.net.http.HttpTimeoutException;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AiCallTraceTest {

    private AiTraceCapture capture;

    @BeforeEach
    void setUp() {
        capture = new AiTraceCapture();
    }

    @AfterEach
    void tearDown() {
        capture.close();
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("thành công: một dòng INFO đủ trường, có token, metric result=ok")
    void success() {
        AiCallTrace t = AiCallTrace.start("chat", "https://api.fireworks.ai/inference/v1/chat/completions",
                "accounts/fireworks/models/gpt-oss-20b");
        t.tokens(1200, 300).ok();

        String line = capture.single();
        assertThat(line).startsWith("AI_CALL feature=chat provider=fireworks model=accounts/fireworks/models/gpt-oss-20b "
                + "host=api.fireworks.ai ms=");
        assertThat(line).contains("result=ok attempts=1 fallbacks=0 tokens_in=1200 tokens_out=300 user=- job=-");
        assertThat(capture.events().get(0).getLevel()).isEqualTo(Level.INFO);
        assertThat(capture.meters.get("ai.call").tags("feature", "chat", "provider", "fireworks", "result", "ok")
                .timer().count()).isEqualTo(1);
    }

    @Test
    @DisplayName("lỗi HTTP 503 sau 2 lần thử lại: WARN, result=http_503, attempts=3, metric gom http_5xx")
    void httpErrorWithRetries() {
        AiCallTrace t = AiCallTrace.start("grading_exam", "https://api.groq.com/openai/v1/chat/completions", "m");
        t.retry().retry();
        t.fail(new AiServiceException("bọc", HttpServerErrorException.create(
                HttpStatus.SERVICE_UNAVAILABLE, "x", HttpHeaders.EMPTY, new byte[0], null)));

        String line = capture.single();
        assertThat(line).contains("provider=groq").contains("result=http_503 attempts=3 fallbacks=0");
        assertThat(line).contains("tokens_in=- tokens_out=-");
        assertThat(capture.events().get(0).getLevel()).isEqualTo(Level.WARN);
        assertThat(capture.meters.get("ai.call").tag("result", "http_5xx").timer().count()).isEqualTo(1);
    }

    @Test
    @DisplayName("timeout: nhận ra qua chuỗi cause (ResourceAccessException → SocketTimeoutException) và HttpTimeoutException")
    void timeout() {
        AiCallTrace.start("chat", "https://a.example/x", "m")
                .fail(new ResourceAccessException("I/O", new SocketTimeoutException("Read timed out")));
        AiCallTrace.start("stt", "https://b.example/x", "m")
                .fail(new HttpTimeoutException("request timed out"));

        assertThat(capture.lines()).hasSize(2).allMatch(l -> l.contains("result=timeout"));
    }

    @Test
    @DisplayName("dự phòng: ghi đích CUỐI đã gọi, đếm lần gọi và lần chuyển dự phòng")
    void fallback() {
        AiCallTrace t = AiCallTrace.start("stt", "https://api.groq.com/openai/v1/audio/transcriptions",
                "whisper-large-v3-turbo");
        t.fallback("https://api.groq.com/openai/v1/audio/transcriptions", "whisper-large-v3");
        t.retry("https://api.groq.com/openai/v1/audio/transcriptions", "whisper-large-v3-turbo");
        t.failHttp(429);

        String line = capture.single();
        assertThat(line).contains("model=whisper-large-v3-turbo")
                .contains("result=http_429 attempts=3 fallbacks=1");
        assertThat(capture.meters.get("ai.call").tag("result", "http_429").timer().count()).isEqualTo(1);
    }

    @Test
    @DisplayName("lỗi tự sinh (hàng chờ đầy) dùng mã máy-đọc-được; lỗi lạ dùng tên lớp")
    void appErrors() {
        AiCallTrace.start("chat", null, null)
                .fail(new AiServiceException(AiErrorCode.AI_BUSY, "bận", 15));
        AiCallTrace.start("chat", null, null).fail(new IllegalStateException("x"));

        assertThat(capture.lines().get(0)).contains("result=ai_busy").contains("host=- ").contains("model=- ");
        assertThat(capture.lines().get(1)).contains("result=error_IllegalStateException");
    }

    @Test
    @DisplayName("chỉ kết thúc một lần: lần gọi ok() thứ hai bị bỏ qua")
    void finishesOnce() {
        AiCallTrace t = AiCallTrace.start("chat", "https://x.example", "m");
        t.ok();
        t.fail(new RuntimeException());
        assertThat(capture.lines()).hasSize(1);
    }

    @Test
    @DisplayName("không lộ bí mật: không ghi path, query (khoá), hay id người dùng thật")
    void noSecretsOrIds() {
        User u = new User();
        u.setId(4242L);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(u, null, List.of()));

        AiCallTrace.start("gemini-document",
                "https://generativelanguage.googleapis.com/v1beta/models/x:generateContent?key=SECRET123", "g").ok();

        String line = capture.single();
        assertThat(line).doesNotContain("SECRET123").doesNotContain("v1beta").doesNotContain("4242");
        assertThat(line).contains("host=generativelanguage.googleapis.com").contains("provider=google");
        assertThat(line).containsPattern("user=u:[0-9a-f]{8}");
        assertThat(AiCallTrace.hashUser(4242L)).isEqualTo(AiCallTrace.hashUser(4242L))
                .isNotEqualTo(AiCallTrace.hashUser(4243L));
    }

    @Test
    @DisplayName("tên tính năng do nơi gọi đặt thắng nhãn mặc định của client, và được trả lại sau khối")
    void featureScope() {
        AiCallTrace.withFeature("EXAM_STUDIO_WRITE_TEXT", () -> {
            AiCallTrace.start("grading_exam", "https://x.example", "m").ok();
            return null;
        });
        AiCallTrace.start("chat", "https://x.example", "m").ok();

        assertThat(capture.lines().get(0)).contains("feature=EXAM_STUDIO_WRITE_TEXT");
        assertThat(capture.lines().get(1)).contains("feature=chat");
    }

    @Test
    @DisplayName("nhãn nhà cung cấp theo host")
    void providers() {
        assertThat(AiCallTrace.providerOf("api.groq.com")).isEqualTo("groq");
        assertThat(AiCallTrace.providerOf("audio-turbo.us-virginia-1.direct.fireworks.ai")).isEqualTo("fireworks");
        assertThat(AiCallTrace.providerOf("localhost:8000")).isEqualTo("local");
        assertThat(AiCallTrace.providerOf("edge-tts")).isEqualTo("local");
        assertThat(AiCallTrace.providerOf("router.example.org")).isEqualTo("other");
        assertThat(AiCallTrace.hostOf("http://edge-tts:5050/tts?text=hallo")).isEqualTo("edge-tts:5050");
    }
}
