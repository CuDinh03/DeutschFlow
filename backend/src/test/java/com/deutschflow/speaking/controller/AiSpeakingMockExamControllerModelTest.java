package com.deutschflow.speaking.controller;

import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.speaking.AiRateLimiterService;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.service.SprechenTeil2Service;
import com.deutschflow.user.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Khoá regression: mock-exam evaluate ({@code POST /api/onboarding/mock-exam/evaluate}) PHẢI truyền
 * model = null vào chatCompletion → dùng model NÓI mặc định (app.ai.groq.model).
 *
 * <p>Cùng họ bug với #94 / SprechenTeil2: code cũ truyền {@code "json_object"} vào ô MODEL → Groq
 * nhận model="json_object" → HTTP 400 → catch → endpoint trả 500 "Phân tích thất bại" MỖI LẦN.
 * JSON output đã được GroqChatClient ép sẵn bằng response_format, nên ô model không dùng để bật JSON.
 */
@ExtendWith(MockitoExtension.class)
class AiSpeakingMockExamControllerModelTest {

    @Mock OpenAiChatClient chatClient;
    @Mock JdbcTemplate jdbcTemplate;
    @Mock SprechenTeil2Service sprechenTeil2Service;
    @Mock AiRateLimiterService aiRateLimiterService;
    @Mock QuotaService quotaService;
    @Mock OrgPoolGuard orgPoolGuard;

    private AiSpeakingMockExamController controller() {
        return new AiSpeakingMockExamController(
                chatClient, jdbcTemplate, new ObjectMapper(), sprechenTeil2Service, aiRateLimiterService,
                quotaService, orgPoolGuard);
    }

    @Test
    @DisplayName("evaluateMockExam truyền model = null, KHÔNG phải \"json_object\"")
    void evaluateMockExam_passesNullModel() {
        when(aiRateLimiterService.allow(any(), anyLong())).thenReturn(true);
        when(chatClient.chatCompletion(any(), nullable(String.class), anyDouble(), any()))
                .thenReturn(new AiChatCompletionResult(
                        "{\"estimated_cefr\":\"B1\","
                                + "\"radar_chart\":{\"grammar\":70,\"pronunciation\":65,\"vocabulary\":72,\"fluency\":68},"
                                + "\"top_errors\":[],\"summary_vi\":\"Khá ổn.\"}",
                        null, "GROQ", "default-speaking-model"));
        // jdbcTemplate.queryForObject (INSERT ... RETURNING id) is left unstubbed → returns null;
        // the controller stores id=null and still returns 200, so we don't depend on the DB here.

        User user = mock(User.class);
        when(user.getId()).thenReturn(7L);

        ResponseEntity<Map<String, Object>> resp = controller().evaluateMockExam(
                user, Map.of("transcript_de",
                        "Ich heiße Anna und ich lerne seit zwei Jahren Deutsch in Hanoi."));

        // Reached the AI branch and parsed the result (not the 400/badRequest/500 path).
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).containsEntry("estimated_cefr", "B1");

        ArgumentCaptor<String> model = ArgumentCaptor.forClass(String.class);
        verify(chatClient).chatCompletion(any(), model.capture(), anyDouble(), any());
        assertThat(model.getValue())
                .as("Mock-exam evaluation must use the default speaking model (null), never \"json_object\"")
                .isNull();
    }
}
