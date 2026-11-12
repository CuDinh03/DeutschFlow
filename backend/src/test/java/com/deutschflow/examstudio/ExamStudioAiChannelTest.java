package com.deutschflow.examstudio;

import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.ai.tier.TierSpec;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.examstudio.ExamStudioAi.Channel;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.exception.AiServiceException;
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
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Hai kênh tạo đề của Xưởng đề — hai máy chủ HTTP giả trên localhost đóng vai Fireworks và 9Router. */
@DisplayName("Xưởng đề — chọn kênh tạo đề (Fireworks / 9Router)")
class ExamStudioAiChannelTest {

    private static final ObjectMapper OM = new ObjectMapper();
    private HttpServer fireworks;
    private HttpServer router;
    private final AtomicInteger fireworksStatus = new AtomicInteger(200);
    private final List<JsonNode> fireworksBodies = new ArrayList<>();
    private final List<JsonNode> routerBodies = new ArrayList<>();
    private final List<String> routerAuth = new ArrayList<>();

    private final OpenAiChatClient chatClient = mock(OpenAiChatClient.class);
    private final AiUsageLedgerService ledger = mock(AiUsageLedgerService.class);
    private final LlmTierResolver tiers = mock(LlmTierResolver.class);
    private ExamStudioAi ai;

    private static byte[] completion(String content) {
        try {
            return OM.writeValueAsBytes(OM.createObjectNode().set("choices", OM.createArrayNode().add(
                    OM.createObjectNode().put("finish_reason", "stop")
                            .set("message", OM.createObjectNode().put("content", content)))));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @BeforeEach
    void start() throws Exception {
        fireworks = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        fireworks.createContext("/v1/chat/completions", ex -> {
            fireworksBodies.add(OM.readTree(ex.getRequestBody().readAllBytes()));
            byte[] out = fireworksStatus.get() == 200 ? completion("{\"from\": \"fireworks\"}")
                    : "{\"error\": \"x\"}".getBytes(StandardCharsets.UTF_8);
            ex.sendResponseHeaders(fireworksStatus.get(), out.length);
            ex.getResponseBody().write(out);
            ex.close();
        });
        fireworks.start();
        router = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        router.createContext("/v1/chat/completions", ex -> {
            routerAuth.add(ex.getRequestHeaders().getFirst("Authorization"));
            routerBodies.add(OM.readTree(ex.getRequestBody().readAllBytes()));
            // Model qua cổng trung gian hay bọc JSON trong ```json — phần đọc kết quả phải bóc được.
            byte[] out = completion("```json\n{\"from\": \"router\"}\n```");
            ex.sendResponseHeaders(200, out.length);
            ex.getResponseBody().write(out);
            ex.close();
        });
        router.start();

        String fireworksUrl = "http://127.0.0.1:" + fireworks.getAddress().getPort() + "/v1/chat/completions";
        when(tiers.spec(any())).thenAnswer(inv -> new TierSpec(inv.getArgument(0), "tier-model", fireworksUrl,
                "fireworks-key", List.of(), null, null, List.of(), "low", false, false));
        ai = new ExamStudioAi(chatClient, tiers, ledger, OM);
        ReflectionTestUtils.setField(ai, "writerModel", "kimi-k3");
        ReflectionTestUtils.setField(ai, "judgeModel", "deepseek");
        ReflectionTestUtils.setField(ai, "callTimeoutSeconds", 10);
    }

    @AfterEach
    void stop() {
        ExamStudioAi.clearChannel();
        fireworks.stop(0);
        router.stop(0);
    }

    private void configureRouter(String judgeModel) {
        // Địa chỉ gốc kiểu ".../v1" như cổng OpenAI-compatible hay ghi — code tự nối /chat/completions.
        ReflectionTestUtils.setField(ai, "routerBaseUrl", "http://127.0.0.1:" + router.getAddress().getPort() + "/v1/");
        ReflectionTestUtils.setField(ai, "routerApiKey", "router-key");
        ReflectionTestUtils.setField(ai, "routerWriterModel", "claude-writer");
        ReflectionTestUtils.setField(ai, "routerJudgeModel", judgeModel);
    }

    @Test
    @DisplayName("mặc định là kênh Fireworks: 9Router không nhận lượt gọi nào dù đã cấu hình")
    void defaultChannelIsFireworks() {
        configureRouter("grok-judge");
        JsonNode out = ai.call(7L, "TEXT", LlmTier.CONTENT, "system", "user", 0.6, 3_500);

        assertThat(out.path("from").asText()).isEqualTo("fireworks");
        assertThat(routerBodies).isEmpty();
        JsonNode body = fireworksBodies.get(0);
        assertThat(body.path("model").asText()).isEqualTo("kimi-k3");
        assertThat(body.has("temperature")).isTrue();
        assertThat(body.path("response_format").path("type").asText()).isEqualTo("json_object");
        verify(ledger).record(eq(7L), eq("FIREWORKS"), eq("kimi-k3"), any(), eq("EXAM_STUDIO_TEXT"), any(), any());
    }

    @Test
    @DisplayName("thân trả lời dạng dòng sự kiện (9Router + Claude): ghép các mảnh thành một câu trả lời, giữ finish_reason")
    void parsesEventStream() throws Exception {
        String sse = """
                data: {"id":"c1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

                data: {"id":"c1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"{\\"wort\\": \\"Sch"},"finish_reason":null}]}

                data: {"id":"c1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"metterling\\"}"},"finish_reason":null}]}

                data: {"id":"c1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":12,"completion_tokens":7,"total_tokens":19}}

                data: [DONE]
                """;
        JsonNode out = ExamStudioAi.parseCompletion(OM, sse);
        assertThat(out.path("choices").path(0).path("message").path("content").asText()).isEqualTo("{\"wort\": \"Schmetterling\"}");
        assertThat(out.path("choices").path(0).path("finish_reason").asText()).isEqualTo("stop");
        assertThat(out.path("usage").path("total_tokens").asInt()).isEqualTo(19);

        // Bị cắt giữa chừng vẫn nhận ra để thử lại với ngân sách lớn hơn.
        JsonNode cut = ExamStudioAi.parseCompletion(OM, "data: {\"choices\":[{\"delta\":{\"content\":\"{\"},\"finish_reason\":\"length\"}]}\n");
        assertThat(cut.path("choices").path(0).path("finish_reason").asText()).isEqualTo("length");

        // JSON thường không đổi.
        JsonNode plain = ExamStudioAi.parseCompletion(OM, "{\"choices\":[{\"message\":{\"content\":\"x\"},\"finish_reason\":\"stop\"}]}");
        assertThat(plain.path("choices").path(0).path("message").path("content").asText()).isEqualTo("x");
        assertThat(ExamSetRunService.isModelError("Model soạn đề không trả lời (JsonParseException), vui lòng thử lại.")).isTrue();
        assertThat(ExamSetRunService.isModelError("Chỉ đọc được 143 ký tự nội dung")).isFalse();
    }

    @Test
    @DisplayName("chọn kênh 9Router: mọi lượt đi 9Router với khoá và model riêng, không gửi temperature / response_format")
    void routerChannel() {
        configureRouter("grok-judge");
        ExamStudioAi.useChannel(Channel.ROUTER);

        assertThat(ai.call(7L, "TEXT", LlmTier.CONTENT, "s", "u", 0.6, 3_500).path("from").asText()).isEqualTo("router");
        ai.call(7L, "VERIFY", LlmTier.GRADING_EXAM, "s", "u", 0.0, 800);
        ai.call(7L, "VERIFY", LlmTier.CHAT_FREE, "s", "u", 0.3, 800); // lượt "học viên yếu" cũng không đi kênh khác

        assertThat(fireworksBodies).isEmpty();
        verifyNoInteractions(chatClient); // không đụng đường gọi dùng chung với luyện nói
        assertThat(routerAuth).containsOnly("Bearer router-key");
        assertThat(routerBodies).extracting(b -> b.path("model").asText())
                .containsExactly("claude-writer", "grok-judge", "grok-judge");
        JsonNode body = routerBodies.get(0);
        assertThat(body.path("max_tokens").asInt()).isEqualTo(16_000);
        assertThat(body.has("temperature")).isFalse();
        assertThat(body.has("response_format")).isFalse();
        verify(ledger).record(eq(7L), eq("9ROUTER"), eq("claude-writer"), any(), eq("EXAM_STUDIO_TEXT"), any(), any());
        assertThat(ai.itemsPerCall()).isEqualTo(2);
    }

    @Test
    @DisplayName("hai kênh tách riêng: Fireworks lỗi thì báo lỗi, KHÔNG tự chuyển sang 9Router")
    void noAutomaticSwitch() {
        configureRouter("grok-judge");
        fireworksStatus.set(400);
        assertThatThrownBy(() -> ai.call(7L, "TEXT", LlmTier.CONTENT, "s", "u", 0.6, 100))
                .isInstanceOf(AiServiceException.class).hasMessageContaining("HTTP 400");
        assertThat(routerBodies).isEmpty();
    }

    @Test
    @DisplayName("model chấm của 9Router để trống ⇒ dùng model viết")
    void routerJudgeDefaultsToWriter() {
        configureRouter("");
        ExamStudioAi.useChannel(Channel.ROUTER);
        ai.call(7L, "VERIFY", LlmTier.GRADING_EXAM, "s", "u", 0.0, 800);
        assertThat(routerBodies.get(0).path("model").asText()).isEqualTo("claude-writer");
    }

    @Test
    @DisplayName("kênh 9Router chưa cấu hình: danh sách kênh báo rõ và yêu cầu chọn kênh bị từ chối")
    void routerNotConfigured() {
        assertThat(ai.channels()).extracting(ExamStudioAi.ChannelInfo::id, ExamStudioAi.ChannelInfo::configured)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("FIREWORKS", true),
                        org.assertj.core.groups.Tuple.tuple("ROUTER", false));
        assertThatThrownBy(() -> ai.requireChannel("ROUTER")).isInstanceOf(BadRequestException.class);
        assertThat(ai.requireChannel(null)).isEqualTo(Channel.FIREWORKS);
        assertThatThrownBy(() -> ai.requireChannel("khac")).isInstanceOf(BadRequestException.class);

        configureRouter("grok-judge");
        assertThat(ai.requireChannel("router")).isEqualTo(Channel.ROUTER);
        assertThat(ai.channels().get(1).writerModel()).isEqualTo("claude-writer");
        assertThat(ai.channels().get(1).judgeModel()).isEqualTo("grok-judge");
    }

    @Test
    @DisplayName("chatUrl: nhận '.../v1', '.../v1/' và địa chỉ đầy đủ")
    void chatUrl() {
        assertThat(ExamStudioAi.chatUrl("https://x.example/v1")).isEqualTo("https://x.example/v1/chat/completions");
        assertThat(ExamStudioAi.chatUrl("https://x.example/v1/")).isEqualTo("https://x.example/v1/chat/completions");
        assertThat(ExamStudioAi.chatUrl("https://x.example/v1/chat/completions"))
                .isEqualTo("https://x.example/v1/chat/completions");
    }
}
