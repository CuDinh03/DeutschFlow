package com.deutschflow.grammar.service;

import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DisplayName("AI Exam Evaluator Service")
@ExtendWith(MockitoExtension.class)
class AiExamEvaluatorServiceTest {

    @Mock
    private OpenAiChatClient chatClient;
    @Mock
    private AiUsageLedgerService ledgerService;

    private AiExamEvaluatorService evaluatorService;

    @BeforeEach
    void setUp() {
        evaluatorService = new AiExamEvaluatorService(chatClient, ledgerService);
    }

    @Test
    @DisplayName("evaluates email and returns scored rubric")
    void evaluateSchreibenEmail_validEmail_returnsScoredRubric() {
        String aiResponse = """
            {
              "aufgabenerfuellung": 4,
              "kohaerenz": 3,
              "wortschatz": 2,
              "strukturen": 2,
              "total": 11,
              "max": 15,
              "feedback_vi": "Bạn đã trả lời được 3 yêu cầu. Cần cải thiện từ vựng.",
              "feedback_de": "Sie haben alle 3 Punkte beantwortet.",
              "strengths_vi": ["Cấu trúc rõ ràng", "Đủ 3 điểm yêu cầu"],
              "improvements_vi": ["Dùng từ vựng phong phú hơn"]
            }
            """;
        when(chatClient.chatCompletion(anyList(), isNull(), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult(aiResponse, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L,
            "Hallo, ich heiße Anna und ich komme aus Vietnam.",
            "Schreibe eine Vorstellung."
        );

        assertEquals("AI_EVALUATED", result.get("status"));
        assertEquals(4, result.get("aufgabenerfuellung"));
        assertEquals(3, result.get("kohaerenz"));
        assertEquals(2, result.get("wortschatz"));
        assertEquals(2, result.get("strukturen"));
        assertEquals(11, result.get("total"));
        assertEquals(15, result.get("max"));
        assertNotNull(result.get("feedback_vi"));
    }

    @Test
    @DisplayName("returns pending when email content is empty")
    void evaluateSchreibenEmail_emptyContent_returnsPending() {
        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L,"", "Task");

        assertEquals("PENDING_AI_EVALUATION", result.get("status"));
        assertEquals(0, result.get("total"));
        verifyNoInteractions(chatClient);
    }

    @Test
    @DisplayName("returns pending when email content is null")
    void evaluateSchreibenEmail_nullContent_returnsPending() {
        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L,null, "Task");

        assertEquals("PENDING_AI_EVALUATION", result.get("status"));
        verifyNoInteractions(chatClient);
    }

    @Test
    @DisplayName("clamps scores to valid rubric ranges")
    void evaluateSchreibenEmail_outOfRangeScores_clampsToMax() {
        String aiResponse = """
            {
              "aufgabenerfuellung": 99,
              "kohaerenz": -5,
              "wortschatz": 10,
              "strukturen": 3,
              "total": 0,
              "max": 15,
              "feedback_vi": "test",
              "feedback_de": "test",
              "strengths_vi": [],
              "improvements_vi": []
            }
            """;
        when(chatClient.chatCompletion(anyList(), isNull(), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult(aiResponse, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L,"Some email content here.", null);

        assertEquals(5, result.get("aufgabenerfuellung"), "Should clamp to max 5");
        assertEquals(0, result.get("kohaerenz"), "Should clamp to min 0");
        assertEquals(3, result.get("wortschatz"), "Should clamp to max 3");
        assertEquals(3, result.get("strukturen"));
        // total = 5+0+3+3 = 11
        assertEquals(11, result.get("total"));
    }

    @Test
    @DisplayName("handles malformed JSON gracefully")
    void evaluateSchreibenEmail_malformedJson_returnsPending() {
        when(chatClient.chatCompletion(anyList(), isNull(), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult("not valid json at all {{{{", null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L,"Some valid email.", null);

        assertEquals("PENDING_AI_EVALUATION", result.get("status"));
        assertEquals(0, result.get("total"));
    }

    @Test
    @DisplayName("strips markdown code blocks from AI response")
    void evaluateSchreibenEmail_markdownWrapped_parsesCorrectly() {
        String aiResponse = """
            ```json
            {
              "aufgabenerfuellung": 3,
              "kohaerenz": 2,
              "wortschatz": 1,
              "strukturen": 1,
              "total": 7,
              "max": 15,
              "feedback_vi": "Cần cải thiện nhiều hơn.",
              "feedback_de": "Bitte verbessern Sie.",
              "strengths_vi": [],
              "improvements_vi": ["Cải thiện cấu trúc"]
            }
            ```
            """;
        when(chatClient.chatCompletion(anyList(), isNull(), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult(aiResponse, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L,"Email text here.", null);

        assertEquals("AI_EVALUATED", result.get("status"));
        assertEquals(7, result.get("total"));
    }

    @Test
    @DisplayName("handles AI service exception gracefully")
    void evaluateSchreibenEmail_aiServiceThrows_returnsPending() {
        when(chatClient.chatCompletion(anyList(), isNull(), anyDouble(), anyInt()))
            .thenThrow(new RuntimeException("Service unavailable"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L,"Some email content.", null);

        assertEquals("PENDING_AI_EVALUATION", result.get("status"));
        assertEquals(0, result.get("total"));
    }
}
