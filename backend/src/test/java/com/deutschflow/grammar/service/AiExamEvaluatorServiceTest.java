package com.deutschflow.grammar.service;

import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.ai.tier.TierSpec;
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
    private LlmTierResolver llmTierResolver;
    @Mock
    private AiUsageLedgerService ledgerService;

    private AiExamEvaluatorService evaluatorService;

    @BeforeEach
    void setUp() {
        evaluatorService = new AiExamEvaluatorService(chatClient, llmTierResolver, ledgerService);
        // lenient: vài test đi nhánh early-return không chạm LLM (MockitoExtension strict-stubs)
        org.mockito.Mockito.lenient().when(llmTierResolver.spec(LlmTier.GRADING_EXAM))
                .thenReturn(new TierSpec(LlmTier.GRADING_EXAM, "openai/gpt-oss-120b", null, null, null, null, null, null, null, false, false));
    }

    @Test
    @DisplayName("mô hình bỏ sót một tiêu chí thì tiêu chí đó rời khỏi thang, không bị tính 0")
    void evaluateSchreibenEmail_missingCriterion_shrinksMaxInsteadOfScoringZero() {
        // Phiếu thật trên prod: nhận xét khen ngữ pháp mức B2 nhưng `strukturen` ra 0/3 — parser cũ
        // đọc khoá thiếu thành 0 y hệt điểm 0 thật.
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult("""
                {"aufgabenerfuellung":5,"kohaerenz":4,"wortschatz":3,
                 "feedback_vi":"Ngữ pháp ở mức B2","feedback_de":"Gut","strengths_vi":[],"improvements_vi":[]}
                """, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, "Ein Text.", "Task", "B2");

        assertEquals(12, result.get("total"), "chỉ cộng ba tiêu chí mô hình có chấm");
        assertEquals(12, result.get("max"), "thang co lại theo tiêu chí có mặt, không còn 15");
        assertEquals(100, result.get("percentage"));
        assertNull(result.get("strukturen"), "không bịa điểm cho tiêu chí mô hình không chấm");
        assertEquals(List.of("strukturen"), result.get("missing_criteria"));
    }

    @Test
    @DisplayName("khoá lệch tên vẫn đọc được thay vì rơi về 0")
    void evaluateSchreibenEmail_aliasKeys_areRead() {
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult("""
                {"aufgabenerfuellung":4,"kohärenz":3,"vocabulary":2,"grammatik":3,
                 "feedback_vi":"Ổn","feedback_de":"Okay","strengths_vi":[],"improvements_vi":[]}
                """, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, "Ein Text.", "Task", "B1");

        assertEquals(3, result.get("strukturen"), "khoá `grammatik` phải được hiểu là strukturen");
        assertEquals(3, result.get("kohaerenz"));
        assertEquals(2, result.get("wortschatz"));
        assertEquals(12, result.get("total"));
        assertEquals(15, result.get("max"));
        assertNull(result.get("missing_criteria"));
    }

    @Test
    @DisplayName("thiếu TOÀN BỘ tiêu chí thì để chờ chấm, không trả điểm 0")
    void evaluateSchreibenEmail_noCriteriaAtAll_returnsPending() {
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult("""
                {"feedback_vi":"Không chấm được","strengths_vi":[],"improvements_vi":[]}
                """, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, "Ein Text.", "Task", "B1");

        assertEquals("PENDING_AI_EVALUATION", result.get("status"));
    }

    @Test
    @DisplayName("chấm bài viết theo rubric của trình độ đề, không đóng cứng A1")
    void evaluateSchreibenEmail_usesExamLevelInPrompt() {
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult("""
                {"aufgabenerfuellung":5,"kohaerenz":4,"wortschatz":3,"strukturen":3,"total":15,"max":15,
                 "feedback_vi":"Tốt","feedback_de":"Gut","strengths_vi":[],"improvements_vi":[]}
                """, null, "GROQ", "test-model"));
        var captor = org.mockito.ArgumentCaptor.forClass(List.class);

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(
                1L, "Meiner Meinung nach sollte der Nahverkehr günstiger werden.", "Forumsbeitrag schreiben", "B2");

        verify(chatClient).chatCompletionForTier(captor.capture(), any(TierSpec.class), anyDouble(), anyInt());
        String gopLai = ((List<ChatMessage>) captor.getValue()).stream()
                .map(ChatMessage::content).reduce("", (a, b) -> a + "\n" + b);
        assertTrue(gopLai.contains("CEFR level of this exam: B2"), "prompt phải nêu trình độ của đề");
        assertTrue(gopLai.contains("At B2 expect"), "prompt phải kèm kỳ vọng ngôn ngữ của bậc đó");
        assertFalse(gopLai.contains("Start Deutsch 1"), "không được đóng cứng rubric A1 cho đề B2");
        assertEquals("B2", result.get("level"), "kết quả phải nói rõ đã chấm theo rubric nào");
    }

    @Test
    @DisplayName("trình độ rỗng hoặc lạ thì lấy B1 làm mặc định")
    void evaluateSchreibenEmail_unknownLevel_fallsBackToB1() {
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult("""
                {"aufgabenerfuellung":3,"kohaerenz":2,"wortschatz":2,"strukturen":2,"total":9,"max":15,
                 "feedback_vi":"Ổn","feedback_de":"Okay","strengths_vi":[],"improvements_vi":[]}
                """, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, "Hallo Anna.", "Task", "  ");

        assertEquals("B1", result.get("level"));
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
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult(aiResponse, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L,
            "Hallo, ich heiße Anna und ich komme aus Vietnam.",
            "Schreibe eine Vorstellung.",
            "A1"
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
        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, "", "Task", "A1");

        assertEquals("PENDING_AI_EVALUATION", result.get("status"));
        assertEquals(0, result.get("total"));
        verifyNoInteractions(chatClient);
    }

    @Test
    @DisplayName("returns pending when email content is null")
    void evaluateSchreibenEmail_nullContent_returnsPending() {
        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, null, "Task", "A1");

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
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult(aiResponse, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, "Some email content here.", null, "A1");

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
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult("not valid json at all {{{{", null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, "Some valid email.", null, "A1");

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
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult(aiResponse, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, "Email text here.", null, "A1");

        assertEquals("AI_EVALUATED", result.get("status"));
        assertEquals(7, result.get("total"));
    }

    @Test
    @DisplayName("handles AI service exception gracefully")
    void evaluateSchreibenEmail_aiServiceThrows_returnsPending() {
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenThrow(new RuntimeException("Service unavailable"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, "Some email content.", null, "A1");

        assertEquals("PENDING_AI_EVALUATION", result.get("status"));
        assertEquals(0, result.get("total"));
    }
}
