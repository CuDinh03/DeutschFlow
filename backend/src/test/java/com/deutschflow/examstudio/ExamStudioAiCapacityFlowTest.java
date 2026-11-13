package com.deutschflow.examstudio;

import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

@DisplayName("Xưởng đề — model hết chỗ: chờ, thử lại đúng model, rồi sang bản kế tiếp (đi qua HTTP thật)")
class ExamStudioAiCapacityFlowTest {

    private static final ObjectMapper OM = new ObjectMapper();
    private static final String NO_CAPACITY = "{\"error\":{\"message\":\"[antigravity/a] [503]: No capacity available for model a "
            + "on the server MODEL_CAPACITY_EXHAUSTED (reset after 1s)\"}}";
    private HttpServer router;
    private final List<String> calledModels = new CopyOnWriteArrayList<>();
    private volatile java.util.Set<String> full = java.util.Set.of();
    private ExamStudioAi ai;

    @BeforeEach
    void start() throws Exception {
        router = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        router.createContext("/v1/chat/completions", ex -> {
            JsonNode body = OM.readTree(ex.getRequestBody().readAllBytes());
            String model = body.path("model").asText();
            calledModels.add(model);
            byte[] out;
            int code;
            if (full.contains(model)) {
                code = 503;
                out = NO_CAPACITY.getBytes(StandardCharsets.UTF_8);
            } else {
                code = 200;
                out = OM.writeValueAsBytes(OM.createObjectNode().set("choices", OM.createArrayNode().add(
                        OM.createObjectNode().put("finish_reason", "stop").set("message",
                                OM.createObjectNode().put("content", "{\"from\":\"" + model + "\"}")))));
            }
            ex.sendResponseHeaders(code, out.length);
            ex.getResponseBody().write(out);
            ex.close();
        });
        router.start();
        ai = new ExamStudioAi(mock(OpenAiChatClient.class), mock(LlmTierResolver.class), mock(AiUsageLedgerService.class), OM);
        ReflectionTestUtils.setField(ai, "callTimeoutSeconds", 10);
        ReflectionTestUtils.setField(ai, "routerBaseUrl", "http://127.0.0.1:" + router.getAddress().getPort() + "/v1/");
        ReflectionTestUtils.setField(ai, "routerApiKey", "router-key");
        ReflectionTestUtils.setField(ai, "routerWriterModel", "claude-writer");
        ReflectionTestUtils.setField(ai, "routerJudgeModel", "gem-high");
        ReflectionTestUtils.setField(ai, "capacityFallbackModels", "gem-high,gem-medium,gem-argon");
        ExamStudioAi.useChannel(ExamStudioAi.Channel.ROUTER);
    }

    @AfterEach
    void stop() {
        ExamStudioAi.clearChannel();
        router.stop(0);
    }

    @Test
    @DisplayName("model chính và bản thứ hai hết chỗ ⇒ gọi chính, chờ, gọi lại chính, rồi bản hai, rồi bản ba trả lời")
    void waitsRetriesThenFallsBack() {
        full = java.util.Set.of("gem-high", "gem-medium");
        long t0 = System.currentTimeMillis();
        JsonNode out = ai.call(7L, "VERIFY", LlmTier.GRADING_EXAM, "system", "user", 0.0, 800);

        assertThat(out.path("from").asText()).isEqualTo("gem-argon");
        // Không thử lại ngay trong cùng lượt: đúng một lần gọi mỗi bước.
        assertThat(calledModels).containsExactly("gem-high", "gem-high", "gem-medium", "gem-argon");
        // Có chờ theo "reset after 1s" (+1 giây đệm) trước khi gọi lại model chính.
        assertThat(System.currentTimeMillis() - t0).isGreaterThanOrEqualTo(1_900L);
    }

    @Test
    @DisplayName("mọi bản đều hết chỗ ⇒ báo lỗi hết chỗ; model viết (ngoài danh sách) không bao giờ bị thay")
    void allFullAndWriterNeverSwapped() {
        full = java.util.Set.of("gem-high", "gem-medium", "gem-argon", "claude-writer");
        assertThatThrownBy(() -> ai.call(7L, "VERIFY", LlmTier.GRADING_EXAM, "system", "user", 0.0, 800))
                .isInstanceOf(ExamStudioAi.CapacityException.class);
        assertThat(calledModels).containsExactly("gem-high", "gem-high", "gem-medium", "gem-argon");

        calledModels.clear();
        assertThatThrownBy(() -> ai.call(7L, "TEXT", LlmTier.CONTENT, "system", "user", 0.6, 800))
                .isInstanceOf(ExamStudioAi.CapacityException.class);
        assertThat(calledModels).containsExactly("claude-writer", "claude-writer");
    }
}
