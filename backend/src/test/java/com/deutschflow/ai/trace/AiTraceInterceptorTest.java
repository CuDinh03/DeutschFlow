package com.deutschflow.ai.trace;

import com.deutschflow.common.http.RestTemplates;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Bộ ghi gắn vào RestTemplate, chạy với máy chủ HTTP giả cục bộ (không gọi nhà cung cấp thật). */
class AiTraceInterceptorTest {

    private HttpServer server;
    private String base;
    private AiTraceCapture capture;

    @BeforeEach
    void setUp() throws IOException {
        capture = new AiTraceCapture();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        base = "http://127.0.0.1:" + server.getAddress().getPort();
        server.createContext("/ok", ex -> reply(ex, 200));
        server.createContext("/boom", ex -> reply(ex, 500));
        server.createContext("/slow", ex -> {
            try {
                Thread.sleep(1_500);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
            reply(ex, 200);
        });
        server.start();
    }

    private static void reply(com.sun.net.httpserver.HttpExchange ex, int status) throws IOException {
        byte[] body = "{}".getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().add("Content-Type", "application/json");
        ex.sendResponseHeaders(status, body.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(body);
        }
    }

    @AfterEach
    void tearDown() {
        capture.close();
        server.stop(0);
    }

    private RestTemplate rest(AiTraceInterceptor interceptor) {
        RestTemplate rt = RestTemplates.withTimeouts(1_000, 500);
        rt.getInterceptors().add(interceptor);
        return rt;
    }

    @Test
    @DisplayName("200 → result=ok; không ghi path hay query")
    void ok() {
        rest(new AiTraceInterceptor("tts", "edge-tts")).postForObject(base + "/ok?text=Hallo", null, String.class);

        String line = capture.single();
        assertThat(line).contains("feature=tts provider=local model=edge-tts host=127.0.0.1:").contains("result=ok");
        assertThat(line).doesNotContain("Hallo").doesNotContain("/ok");
    }

    @Test
    @DisplayName("500 → result=http_500")
    void httpError() {
        assertThatThrownBy(() -> rest(new AiTraceInterceptor("tts", "edge-tts"))
                .postForObject(base + "/boom", null, String.class));
        assertThat(capture.single()).contains("result=http_500");
    }

    @Test
    @DisplayName("quá thời gian đọc → result=timeout")
    void timeout() {
        assertThatThrownBy(() -> rest(new AiTraceInterceptor("tts", "edge-tts"))
                .postForObject(base + "/slow", null, String.class));
        assertThat(capture.single()).contains("result=timeout");
    }

    @Test
    @DisplayName("byPath: tên tính năng lấy đoạn đầu của path, bỏ phần sau và query")
    void byPath() {
        rest(AiTraceInterceptor.byPath("local-ai", null)).postForObject(base + "/ok/sub?text=geheim", null, String.class);
        assertThat(capture.single()).contains("feature=local-ai:ok ").doesNotContain("geheim").doesNotContain("sub");
    }
}
